## Goal

On `/admin/surveys`, let staff click into any survey card and see the list of students who have completed it.

## What changes

### New "Completions" button on every SurveyCard

Adds a third action next to **Preview** and the review/manage link. Clicking it opens a dialog titled "Completed by — {survey name}" with:

- Search box (filter by student name or email)
- Table: Student (links to `/students/:id`) · Organization · Submissions count · Last submitted
- Empty state when nobody has completed it yet ("No completions yet")
- Loading + error states

The dialog respects role: case managers / org admins see only students they have access to (existing RLS already enforces this — the query just runs through the authenticated client).

### Single shared dialog component

`SurveyCompletionsDialog` accepts a `source` describing which table to read:

- `checkin` → `student_checkins`
- `post_grad` → `post_graduation_plans`
- `intake` → `intake_responses`
- `career_intake` → `career_intake_responses`
- `impact:<slug>` → `impact_survey_responses` filtered by joined `impact_survey_templates.slug`

The dialog groups rows by `student_id`, computes count + max(submitted/created at), then joins to `profiles` (full_name, email, organization_id) and `training_organizations` (name) in one follow-up query.

### Wiring

- `SurveysIndex` passes the existing `preview` identifier as the completions source — no new IDs to invent.
- Life Skills cards keep "Manage & send"; the new "Completions" button replaces nothing, it adds.

## Technical details

- New file `src/components/admin/SurveyCompletionsDialog.tsx` — controlled dialog reading from the right table based on `source` prop.
- New hook `src/hooks/useSurveyCompletions.ts` — one `useQuery` that switches on source, returns `{ student_id, count, last_at, full_name, email, organization_name }[]`.
- Edit `src/pages/admin/SurveysIndex.tsx` — render the new button on `SurveyCard`, wire it to open the dialog with the row's `preview` value.

No database, RLS, or edge function changes.
