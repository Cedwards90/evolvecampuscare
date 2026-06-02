## Goal
Let Admins edit and delete any student's survey submissions (check-ins, post-graduation plans, intake responses, impact survey responses) in addition to students editing their own.

## Database (migration)

Add admin UPDATE + DELETE RLS policies on the four tables. Students' existing policies remain unchanged.

- `student_checkins` — add `Admins can update all checkins` and `Admins can delete all checkins`
- `post_graduation_plans` — add `Admins can update all plans` and `Admins can delete all plans`
- `intake_responses` — add `Admins can update all intake` and `Admins can delete all intake`
- `impact_survey_responses` — add `Admins can update all responses` and `Admins can delete all responses`

All policies gated by `has_role(auth.uid(), 'admin'::app_role)`.

## Frontend

Reuse the "My Submissions" UI as the foundation. Add an admin-facing variant accessible from the existing student folder/detail view (StudentFile or StudentDetail page — wherever an admin already drills into one student).

1. **New page**: `/admin/students/:studentId/submissions` (admin-only route guard)
   - Same tabbed layout as student `MySubmissions` (Check-ins, Plan, Intake, Impact)
   - Each list row gets Edit + Delete buttons (with confirm dialog for delete)
   - Reuses the existing edit forms/dialogs from My Submissions

2. **Hooks**: Generalize the existing update hooks to accept an arbitrary `studentId` (currently scoped to `auth.uid()`). Add `useDeleteCheckIn`, `useDeletePlan`, `useDeleteIntakeResponse`, `useDeleteImpactResponse`. All mutations invalidate the relevant query keys (both student-scoped and admin-scoped).

3. **Entry point**: Add a "View Submissions" button on the admin's student folder/detail page that routes to the new page.

## Out of scope
- Case Managers / Org Admins editing surveys (admin only per request)
- Audit log of admin edits (can add later if needed)
- Bulk delete

## Files touched (estimate)
- 1 migration
- `src/hooks/useMySubmissions.ts` (or wherever update hooks live) — extend + add delete mutations
- `src/pages/admin/AdminStudentSubmissions.tsx` (new)
- `src/App.tsx` — register route
- Student folder/detail page — add entry button
- `mem://features/my-submissions-v1` → bump to v2 noting admin capabilities
