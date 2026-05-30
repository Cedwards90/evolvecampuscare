# User Account Activation Controls

Reversible deactivation for any user. Preserves profile, role, assignments, notes, requests, reports, and all history. No deletes.

## 1. Database (migration)

**`profiles` — add status columns**
- `deactivated_at timestamptz null`
- `deactivated_by uuid null`
- `deactivation_reason text null`
- `reactivated_at timestamptz null`
- `reactivated_by uuid null`
- Index on `deactivated_at` for fast filtering.

**New table `user_status_audit`** (append-only)
- `id`, `user_id`, `actor_id`, `action` ('deactivated' | 'reactivated'), `reason text`, `created_at`.
- RLS: admins full read; org admins read users in their org scope (using existing `user_in_org_admin_scope_v2`); inserts only via service role (edge function).
- Added to `supabase_realtime` publication with `REPLICA IDENTITY FULL`.

**New helper function `public.is_user_active(_user_id uuid) returns boolean`**
- `security definer`, returns `profiles.deactivated_at IS NULL`.

**Update `public.has_role(_user_id, _role)`**
- Wrap existing logic with `AND public.is_user_active(_user_id)`.
- Single point that automatically gates `can_staff_manage_student`, `is_org_admin`, `can_staff_access_request`, and every RLS policy that calls `has_role` — so an inactive admin/case manager/org admin instantly loses access platform-wide. Inactive students lose role-gated routes too.
- This is the only existing function touched; no other RLS policies modified.

**Realtime router**
- Add `user_status_audit` and `profiles` (deactivation columns already covered by existing profiles entry) to `src/lib/realtimeRouter.ts` to invalidate `['users-with-roles']`, `['profile', userId]`, and the auth role cache key.

## 2. Edge function `set-user-active` (new)

Admin-only mutation endpoint. Why a function instead of a direct UPDATE: needs to (a) verify caller is admin via `auth.getUser()` + `has_role`, (b) write the audit row, (c) call `supabase.auth.admin.signOut(targetUserId, 'global')` on deactivation to immediately invalidate existing sessions, (d) timestamp atomically.

Inputs: `{ userId, active: boolean, reason?: string }`.
Behavior:
- Reject self-deactivation.
- On deactivate: set `deactivated_at = now()`, `deactivated_by = caller`, store reason, revoke all refresh tokens for that user.
- On reactivate: clear `deactivated_at`, set `reactivated_at/by`.
- Insert `user_status_audit` row.
- Uses shared `sanitizeError`, strict CORS, `timingSafeEqual` patterns already in `_shared` (per existing edge-function security memory).

Org Admins are intentionally **not** granted this in v1 — keeps the blast radius small and matches "administrators" wording. Can be extended later if requested.

## 3. Frontend — login & session enforcement

**`AuthContext.tsx`**
- After `fetchUserData`, if `profile.deactivated_at` is set: call `supabase.auth.signOut()`, surface a `deactivated` flag, redirect to `/auth?reason=deactivated`.
- Subscribe (via existing realtime bridge) so an admin deactivating a logged-in user kicks them on next tick — combined with the edge function's `admin.signOut` this gives near-instant termination.

**`Auth.tsx`**
- When URL has `?reason=deactivated`, show a non-revealing message: "This account is inactive. Contact your administrator."
- No change to sign-in API call itself — `auth.admin.signOut` plus the post-login profile check handle blocking.

**`ProtectedRoute.tsx`**
- Add a guard: if `profile?.deactivated_at`, render redirect to `/auth?reason=deactivated`. Defense-in-depth against any race between login and the AuthContext sign-out.

## 4. Admin UI

**`useUsers` hook**
- Select `deactivated_at`, `deactivated_by`, `deactivation_reason` from profiles. Expose `is_active` derived boolean on `UserWithRole`.
- New `useSetUserActive()` mutation hook invoking the edge function with optimistic update and rollback.
- New `useUserStatusHistory(userId)` hook for the audit timeline.

**`src/components/admin/UserManagement.tsx`**
- New "Status" column with an Active/Inactive `Badge`.
- New "Status" filter (All / Active / Inactive) next to the existing role filter.
- Row action: `Switch` (or dropdown item) to toggle status, opening a confirmation `AlertDialog` with an optional reason `Textarea`. Disable the toggle for the current user.
- Inactive rows render with `opacity-60` and a tooltip showing who/when deactivated.

**`UserManagementPage.tsx`**
- Add a small "Account status history" drawer/section per user that shows `user_status_audit` entries (actor, action, reason, timestamp).

No changes to the existing role-change flow, delete flow, or any other admin screens.

## 5. Compliance & data preservation

- Zero deletes. All assignments, notes, requests, files, reports, certifications, transfers, NDA acceptances, and historical activity remain intact and queryable for compliance.
- Audit trail is append-only and protected by RLS.
- Real-time propagation via the existing `useRealtimeBridge`.

## Technical summary

```text
profiles ── deactivated_at/by/reason, reactivated_at/by  (new columns)
user_status_audit (new, append-only)
is_user_active() ── new SECURITY DEFINER helper
has_role() ── wrapped with is_user_active() check  ← only existing fn modified
set-user-active edge fn ── admin-only, revokes sessions, writes audit
AuthContext + ProtectedRoute ── post-login + per-navigation guard
UserManagement UI ── status column, filter, toggle w/ reason, audit history
realtimeRouter ── publishes status changes sitewide
```

## Out of scope (will not change without approval)

- Existing RLS policies on any other table.
- Existing role-change / delete-user flows.
- Org Admin permissions on activation (admins only for v1).
- Sidebar, dashboards, or other non-admin pages.
