## Add admin delete buttons on survey pages

The four survey types already have admin-only DELETE RLS in place and an admin delete UX exists at `/admin/students/:id/submissions`. This adds the same delete capability directly to the individual survey pages so admins don't have to detour through the submissions hub.

### Scope
Admin-only delete on:
- `/student/check-in` (StudentCheckIn.tsx) — delete the most recent check-in shown
- `/student/post-graduation-plan` (PostGraduationPlan.tsx) — delete the student's plan
- `/student/intake-survey` (IntakeSurvey.tsx) — delete the student's intake response(s)
- Impact tab — already has delete via SubmissionsTabs when `allowDelete` is set; no change needed there

Students never see the delete button. Visibility gated by `useUserRole() === 'admin'`.

### UI
- Add a small destructive outline button "Delete submission" in the page header / card footer, visible only when `role === 'admin'` AND a saved record exists.
- Click opens an `AlertDialog` confirming the deletion (irreversible language).
- On success: invalidate the relevant query, toast confirmation, and reset the form/state to "no submission yet".

### Wiring
Reuse the existing delete mutations already created for `/admin/students/:id/submissions`:
- `useDeleteCheckIn` (deletes by check-in id)
- `useDeletePlan` (deletes by plan id)
- `useDeleteIntake` (deletes by section id)

Each page already loads the current record(s), so the id is available locally.

### Out of scope
- No schema/RLS changes (admin DELETE policies already exist on `student_checkins`, `post_graduation_plans`, `intake_responses`, `impact_survey_responses`).
- No student-facing delete additions.
- No changes to admin submissions hub.

### Files to modify
- `src/pages/StudentCheckIn.tsx`
- `src/pages/PostGraduationPlan.tsx`
- `src/pages/IntakeSurvey.tsx`

### Memory
Update `mem://features/my-submissions-v2` to note that admin delete is also available inline on each survey page.