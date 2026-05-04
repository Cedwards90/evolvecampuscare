# Show students who haven't completed surveys

Add a "Not Completed" view to the admin Survey Responses page (`/admin/surveys`) for each survey type.

## Definitions
- **Check-In not completed**: student has no `student_checkins` row in the last 21 days (matches the 3-week recurring cadence). Includes students who never submitted one.
- **Post-Graduation Plan not completed**: student has no `post_graduation_plans` row at all.

Pool of "students" = profiles with role `student` (respects existing global org/cohort/year filters and the search box).

## UI
In `src/pages/admin/SurveyResponses.tsx`, change each tab into a 2-state toggle:

```
[ Check-Ins (12 completed · 8 pending) ]   [ Post-Grad Plans (4 · 16 pending) ]
   ( Completed | Pending )
```

A small segmented control under each tab switches between the existing completed table and a new "Pending" table:

| Student | Organization | Last submitted | Days overdue | Action |
|---|---|---|---|---|
| Jane Doe | Evolve Cohort 4 | 28 days ago (or "Never") | 7 | Send reminder |

"Send reminder" reuses the existing `SendSurveyDialog` pre-targeted at that student.

## Data
New hooks in `src/hooks/useSurveyResponses.ts`:
- `usePendingCheckIns()` — left-join students to their latest check-in; return rows where `max(created_at) < now() - 21 days` or null.
- `usePendingPostGradPlans()` — students with no plan row.

Implemented as two queries (students, then aggregate latest dates) joined client-side, mirroring the existing hook style. Org/cohort filters applied client-side like today.

## Out of scope
- No schema changes, no new RLS policies (admin already reads profiles, check-ins, plans).
- No change to thresholds or scheduling logic.
- No bulk reminder send (single-row reminder only).
