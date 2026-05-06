## Goal
Let Org Admins open Student Folders for every student in the organization(s) they administer.

## Gap
`src/hooks/useStudentFolders.ts` only handles `admin` and `case_manager` roles — for `org_admin` it returns nothing (the `enabled` guard rejects them) so the page is empty.

`StudentDetail.tsx` and downstream queries already work for org_admin via existing org-scoped RLS (intake_responses, file_notes, post_graduation_plans, support_requests, student_checkins, etc. all have "Org admins view …" SELECT policies). So once the index page lists their students, drill-down already works.

## Change (frontend only)

**`src/hooks/useStudentFolders.ts`**
1. Add an `org_admin` branch:
   - Fetch `org_admins` rows for `user.id` → list of `organization_id`s.
   - Fetch `profiles` where `organization_id` in that list AND user has the `student` role (intersect with `user_roles`).
   - Use those `studentIds` for the rest of the existing flow (profiles, files, requests, org names).
2. Update the `enabled` guard to also allow `org_admin`.
3. Keep query key the same (it already includes `role` and `user.id`).

No other files need changes:
- `StudentFolders.tsx` already routes for org_admin (sidebar + ProtectedRoute), and the page just renders `useStudentFolders()` results.
- `StudentDetail.tsx` and all sub-hooks rely on RLS that already grants org_admin access in scope.

## Out of scope
- No DB migration; no RLS changes (existing policies already permit org_admin reads).
- No changes to admin or case_manager behavior.
- No edge function work.

## Validation
Sign in as org_admin → open Student Folders → see every student whose profile.organization_id is in one of their orgs (regardless of which case manager, if any, is assigned). Click a student → existing detail surfaces (intake, notes, requests, check-ins) load via RLS.
