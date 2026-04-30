## Problem

**Bug confirmed in production data.** The `handle_invited_signup` trigger only marks the *most recent* invitation per email as accepted (`ORDER BY created_at DESC LIMIT 1`). When an admin sends multiple invitations for the same email (which happens regularly — `tukesha.hill@gmail.com`, `iamkingtureall@gmail.com`, etc. all have older duplicate invites still listed as pending even though the user has already signed up), the older rows stay in `pending` forever. They will only disappear when their `expires_at` passes 7 days later.

Beyond the trigger, query invalidation is mostly good but has gaps: invite-related mutations don't invalidate user/case-manager/student lists, and the new user signup never triggers a client-side refetch of `['invitations']` or `['users-with-roles']` (so admins watching the page won't see the change until they navigate or refresh).

## Scope

This plan changes ONLY:
1. The `handle_invited_signup` database function (one targeted SQL fix)
2. `src/hooks/useInvitations.ts` (centralize cross-cache invalidation)
3. `src/components/admin/PendingInvitationsSection.tsx` (subscribe to realtime + listen to `users-with-roles` cache)
4. `src/pages/admin/UserManagementPage.tsx` (wire realtime/refetch hooks if not already)

No changes to UI layout, business logic outside invite acceptance, RLS policies, or other features.

## Plan

### 1. Fix the trigger (database migration)

Update `handle_invited_signup` to mark **all** pending, non-expired invitations for the new user's email as accepted — not just the latest. Keep all other behavior identical (org assignment, role, auto-assign case manager) but apply it from the *most recent* invitation only (current behavior for those side-effects is correct; we just need to flip every duplicate's `accepted_at`).

```text
- Find the most recent pending invitation -> use it for role/org/assignment side effects (unchanged)
- Then UPDATE user_invitations SET accepted_at = now()
   WHERE email = NEW.email AND accepted_at IS NULL AND expires_at > now()
```

Also: **one-time data backfill** to clear the existing stuck rows (only those whose email already exists in `public.profiles`):

```text
UPDATE user_invitations SET accepted_at = now()
 WHERE accepted_at IS NULL
   AND email IN (SELECT email FROM profiles)
```

### 2. Single source of truth for invitation lists

`useInvitations.ts` already exposes `useInvitations`, `usePendingInvitations`, `useSendInvitation`, `useRevokeInvitation`. Keep those as the only path to invitation data. Two improvements:

- After `useSendInvitation` and `useRevokeInvitation` succeed, also invalidate `['users-with-roles']` (so the user table reflects pending counts) and `['case-managers']` (since invites can target case managers/students).
- Add a small `useInvitationsRealtime()` hook that subscribes to `postgres_changes` on `public.user_invitations` and calls `queryClient.invalidateQueries({ queryKey: ['invitations'] })` plus `['users-with-roles']` on any INSERT/UPDATE/DELETE. Mount it once inside `PendingInvitationsSection` (and reuse on `UserManagementPage` if needed). This makes the trigger-driven `accepted_at` flip propagate to the UI live.

### 3. Audit cross-surface invalidation (no UI changes)

Quick audit of existing mutation hooks to confirm every place that changes shared state (`user_invitations`, `student_assignments`, `user_roles`, `profiles`) invalidates the same set of canonical keys:

| Canonical key | Owners (read) | Mutations that must invalidate it |
|---|---|---|
| `['invitations']` / `['invitations','pending']` | `PendingInvitationsSection`, `UserManagementPage` | send/revoke invitation, **trigger-driven accept (via realtime)** |
| `['users-with-roles']` | `UserManagementPage`, `CaseManagersPage` (indirect) | send/revoke invite, role change, delete user, accept (via realtime) |
| `['case-managers']` | `CaseManagersPage`, assignment dialogs | reassign, assign, delete user, role change |
| `['student-assignments']` / `['unassigned-students']` | Admin assignment views | assign, reassign, delete user |
| `['my-students']`, `['my-assignment']` | Case manager + student dashboards | assign, reassign |

Findings to fix in this loop:
- `useUpdateUserRole` invalidates only `users-with-roles` — also invalidate `case-managers` and `student-assignments` (a role change can promote/demote a case manager, which affects the case-managers page and assignment lists).
- `useSendInvitation` / `useRevokeInvitation` — add `users-with-roles` invalidation (so the UI's "pending" indicator next to a user, if any, refreshes).

These are the only invalidation gaps. All other flows (assign, reassign, delete user) already invalidate the right keys.

### 4. Verification

After the migration runs:
- Confirm the stuck rows for `tukesha.hill@gmail.com`, `iamkingtureall@gmail.com`, `sanif9220@gmail.com`, `successmm4347@gmail.com`, etc. now have `accepted_at` set.
- Confirm "Pending Invitations" card on `/admin/users` shows only truly-pending entries.
- Manually re-send a duplicate invitation to an already-signed-up email; verify both rows end up accepted (no orphans), and the pending list updates without a manual refresh thanks to realtime.

## Out of scope (will ask before touching)

- Preventing duplicate invitations being created in the first place (would change `generate-invitation-token` edge function behavior).
- Showing accepted/expired invitations in the UI (currently filtered out by `usePendingInvitations`).
- Any visual changes to the Case Managers or User Management pages.

## Technical notes

- The trigger update is idempotent and safe to re-run.
- The backfill `UPDATE` matches by email only against `public.profiles` (which was created by `handle_new_user` for every signed-up user) — no risk of marking a never-signed-up invitation as accepted.
- Realtime requires `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_invitations` (one-line migration addition).
- All invalidations remain client-side via `queryClient.invalidateQueries`; we are not adding any new global state stores.
