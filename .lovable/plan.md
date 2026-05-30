# Bulk Student Access Controls by Organization

Admin-only bulk action to deactivate or reactivate **all students** tied to a selected parent organization. Uses the existing per-user deactivation primitives (`profiles.deactivated_at`, `user_status_audit`, session revocation) so historical records (reports, case notes, assignments, documents) stay intact and remain visible to authorized admins exactly as today.

## Scope (what changes)

Only these surfaces are touched. No other parts of the codebase are modified.

1. **New edge function**: `supabase/functions/bulk-set-org-students-active/index.ts`
2. **Config**: append a `[functions.bulk-set-org-students-active]` block with `verify_jwt = false` to `supabase/config.toml` (function handles auth in-code, matching `set-user-active`).
3. **New hook**: `src/hooks/useBulkOrgStudentStatus.ts` (preview query + mutation).
4. **New component**: `src/components/admin/BulkOrgStudentStatusDialog.tsx`.
5. **One mount point**: a "Bulk student access" button added to `src/pages/admin/OrganizationDetail.tsx` header (admin-only, gated by `useUserRole`). No changes to org listing, user management, or any data display logic.

## Edge function: `bulk-set-org-students-active`

Mirrors the security pattern of `set-user-active`:

- Validates `Authorization` header, loads user via anon client + `auth.getUser()`.
- Requires `admin` role in `user_roles` (org admins are **not** allowed — explicit product decision; bulk org-wide deactivation is too destructive for org-scoped roles). Returns 403 otherwise.
- Input (zod-style validation): `{ organizationId: string (uuid), active: boolean, reason?: string (≤500 chars), mode: 'preview' | 'apply', confirmation?: string }`.
- For `mode: 'apply'` when `active=false`, require `confirmation === 'DEACTIVATE'` (matches existing destructive-action pattern from delete-user flow).
- Resolves affected students as the union of:
  - `profiles.user_id` where `organization_id = :org` AND role = `student`
  - `organization_memberships.user_id` where `organization_id = :org AND left_at IS NULL` AND role = `student`
  - Excludes the calling admin (defensive — admins are not students, but matches `set-user-active` self-protection).
  - For `active=true` (reactivate): only rows currently `deactivated_at IS NOT NULL`.
  - For `active=false` (deactivate): only rows currently `deactivated_at IS NULL`.
- **Preview mode** returns `{ count, sample: [{ user_id, full_name, email }] (max 25), totalAffected }` with no writes.
- **Apply mode** processes in batches of 50:
  - Service-role `UPDATE profiles` setting the same fields `set-user-active` sets (deactivated_at/by/reason or reactivated_at/by + clears).
  - Bulk `INSERT` into `user_status_audit` with `action='deactivated'|'reactivated'`, `reason`, and `metadata = { bulk: true, organization_id, batch_id }` where `batch_id` is a generated uuid included in the response for compliance traceability.
  - On deactivation, iterate `admin.auth.admin.signOut(userId, 'global')` per user, wrapped in try/catch (non-fatal).
- Returns `{ success, batchId, processed, failed, skipped, sample }`.
- All errors funneled through `sanitizeError`.

No schema changes required — `user_status_audit` and the `profiles` deactivation columns already exist. The existing `has_role()` security definer already blocks deactivated users platform-wide via `is_user_active()`, so loss-of-access is immediate. RLS on student records (case notes, assignments, reports, attachments, transfers) already keys off `can_staff_manage_student` / org-admin scope, **not** on the student's active flag — so authorized admins continue to see history unchanged. Verified against current `can_staff_manage_student`, `file_notes`, `student_assignments`, `participant_*` policies in context.

## Hook: `useBulkOrgStudentStatus`

- `usePreview(orgId, active)` → React Query against the edge function with `mode: 'preview'`, enabled only when dialog opens.
- `useMutation` → calls with `mode: 'apply'`. On success, invalidates `['users']`, `['organization-detail', orgId]`, `['organization-members', orgId]`, and `['user-status-audit']` query keys (matching existing key conventions). Real-time bridge already covers profile/audit changes.

## Component: `BulkOrgStudentStatusDialog`

Single dialog with two modes (deactivate / reactivate) driven by a prop:

1. **Summary card**: org name + live preview count ("This will deactivate 23 active students in <Org>").
2. **Affected students preview**: scrollable list of up to 25 names/emails, with "+N more" indicator.
3. **Reason field** (required for deactivate, recommended for reactivate; max 500 chars).
4. **Confirmation input**: user must type `DEACTIVATE` (deactivate flow) or `REACTIVATE` (reactivate flow) to enable submit. Matches existing destructive-action UX in admin user deletion.
5. **Footer info**: explicit notice that "Reports, case notes, assignments, documents, and history remain visible to authorized admins. Deactivated students lose login access immediately." + timestamp of action will be recorded.
6. **Submit** → mutation; toast with batch id + processed/failed counts; closes on success.

Uses existing shadcn `Dialog`, `Button`, `Textarea`, `Input`, `Alert`, `ScrollArea` — no new deps.

## Mount point in `OrganizationDetail.tsx`

In the page header actions area, add (admin-only):

- "Deactivate all students" (destructive variant) — opens dialog with `active=false`.
- "Reactivate all students" (secondary) — opens dialog with `active=true`. Disabled when preview count = 0.

No other JSX or logic in that page is altered.

## Compliance & audit checklist

- ✅ Confirmation: typed-string gate.
- ✅ Permission checks: admin-only in edge function + role-gated UI.
- ✅ Affected preview: dedicated preview mode, ≤25 sample names + total.
- ✅ Reason: stored on `profiles.deactivation_reason` and `user_status_audit.reason`.
- ✅ Timestamps: `deactivated_at` / `reactivated_at` already auto-set; `user_status_audit.created_at` provides immutable log.
- ✅ Audit logging: one row per user per action, tagged with `batch_id` and `organization_id` in metadata for compliance reporting.
- ✅ Immediate access loss: `is_user_active()` denies in `has_role()`/`is_org_admin()`; sessions revoked via `auth.admin.signOut(..., 'global')`.
- ✅ History preserved: no deletes; staff/admin RLS on related tables is independent of student active flag.

## Out of scope (no changes)

- No DB migrations.
- No edits to existing edge functions, hooks, pages, or RLS policies.
- No changes to `UserManagement.tsx` or `TrainingOrganizations.tsx` listing pages.
