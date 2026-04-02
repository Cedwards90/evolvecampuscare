
Problem found

- The assignments are being written to `organization_memberships`, but many users still have `profiles.organization_id = null`.
- Both broken areas depend on that profile field today:
  - `TrainingOrganizations.tsx` computes “Members” by filtering `useUsers()` on `organization_id`
  - `UserManagementPage.tsx` shows the org badge by looking up `user.organization_id`
- The likely reason the profile field is not updating is the current `profiles` permissions: users can update their own profile, but admins do not currently have a policy to update other users’ profiles. That makes bulk-assign behave like a partial success.

Implementation plan

1. Fix the backend permission + existing data
- Add an admin update policy for `profiles` so admins can set `organization_id` for other users.
- Backfill `profiles.organization_id` from each user’s active `organization_memberships` row (`left_at IS NULL`) so already-assigned people appear correctly right away.

2. Make user/org data more resilient
- Update `useUsers.ts` to resolve each user’s current organization using active membership as a fallback when `profiles.organization_id` is missing.
- Return `organization_name` directly from the hook so UI pages do not have to re-resolve it separately.

3. Fix member counts on the Organizations page
- Update `TrainingOrganizations.tsx` so “Members” is based on active rows in `organization_memberships`, not only on `profiles.organization_id`.
- Keep the role split by combining active memberships with `user_roles`.

4. Harden bulk assignment flow
- Update `useBulkAssignOrganization()` so it verifies the profile update actually affected the user before inserting the new membership.
- Prevent duplicate active memberships if the user is already in that org.

5. Small UI wiring cleanup
- Update `UserManagementPage.tsx` to render the org from the hook’s resolved `organization_name`.
- Keep the existing filter behavior, but make it work with the repaired/resolved org data.

Files to update

- Migration: add admin profile update policy
- Data repair step: sync `profiles.organization_id` from active memberships
- `src/hooks/useUsers.ts`
- `src/hooks/useTrainingOrganizations.ts`
- `src/pages/admin/TrainingOrganizations.tsx`
- `src/pages/admin/UserManagementPage.tsx`

Expected result

- After bulk-assigning users, the organization member count updates immediately.
- The assigned organization appears next to each person in User Management.
- Existing broken assignments are repaired, not just future ones.
