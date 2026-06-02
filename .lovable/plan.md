## Add per-row delete on /admin/surveys

The admin Surveys page (`/admin/surveys`) lists every check-in and post-graduation plan submission but currently has no way to remove one. This adds an admin-only Delete button to each row/card with a confirm dialog.

### Scope
- `CheckInRow` (check-ins table) — add a trailing Delete icon button.
- `PlanCard` (post-grad plan cards) — add a Delete button in the card header.
- Confirm with `AlertDialog` ("This permanently deletes the submission. This can't be undone.") before deleting.
- On success: toast and React Query invalidation refreshes the list.

### Wiring
Reuse existing mutations — no new DB work; admin DELETE RLS already exists on both tables:
- `useDeleteCheckIn` from `@/hooks/useStudentCheckIns`
- `useDeletePlan` from `@/hooks/usePostGraduationPlan`

Both already invalidate the relevant query keys (`student-checkins`, `latest-checkin`, `my-checkins`, `post-graduation-plans`). Extend each `onSuccess` to also invalidate the `useAllCheckIns` / `useAllPostGradPlans` keys used on this page so the row disappears immediately.

### Files
- `src/pages/admin/SurveyResponses.tsx` — add Delete UI to `CheckInRow` and `PlanCard`.
- `src/hooks/useStudentCheckIns.ts` and `src/hooks/usePostGraduationPlan.ts` — add the admin list query keys to the delete mutations' invalidation set (only if not already covered).

### Out of scope
No schema/RLS changes. No changes to pending tabs (nothing to delete there).