## Goal

Make every survey response a student has submitted visible inside their student folder, so staff don't have to bounce between screens to know what's been completed.

The per-student folder (Student Detail) already has a "Manage Submissions" button for admins that opens a four-tab view (check-ins, post-grad plan, intake, Life Skills/Impact). The problem: case managers and org admins can't see that at a glance, and even admins have to click in to know whether anything is there. We'll surface a compact summary card directly on the folder.

## What changes

### Student Detail page — new "Surveys & Submissions" card

Placed under the existing stats cards, visible to admin, case manager, and org admin. Shows four rows:

- Wellbeing check-ins — count + most recent submission date
- Post-graduation plan — submitted / not submitted (+ last edit date)
- Intake survey — completed / in progress / not started
- Life Skills / Impact surveys — count + most recent submission date

Each row has a "View" link:
- Admins → `/admin/students/:id/submissions` (existing full edit/delete view) opened on the matching tab
- Case managers / org admins → a new read-only view at `/students/:id/submissions` showing the same four tabs without edit/delete controls

Empty rows render as muted "None yet" so staff can immediately see gaps.

### Read-only submissions view for case managers and org admins

New route `/students/:id/submissions` reusing `SubmissionsTabs` with `studentId` set and `allowDelete={false}`. Edit buttons inside the tabs are already hidden when `allowDelete` is false for non-admin contexts; we'll gate the per-tab Edit buttons on role so case managers and org admins see read-only cards. Access is restricted to staff who can already see the student (same guard as Student Detail).

### Default tab via query param

`SubmissionsTabs` accepts an optional `defaultTab` prop (`checkins | plans | intake | impact`) so the summary card's "View" links land on the right tab.

## Technical details

- New component `src/components/students/SurveysSummaryCard.tsx` — fetches counts via existing hooks (`useStudentCheckIns`, `useStudentPlans`, intake query already in `SubmissionsTabs`, `useStudentImpactResponses`) in one card.
- Edit `src/pages/StudentDetail.tsx` — render the card after the stats grid; pass `student.id`.
- Edit `src/components/submissions/SubmissionsTabs.tsx` — add optional `defaultTab` prop wired to the `Tabs` `value`/`defaultValue`; hide per-row Edit buttons unless the viewer is an admin or the student themselves.
- New page `src/pages/StudentSubmissionsView.tsx` — staff read-only wrapper; reads `?tab=` from the URL.
- Edit `src/App.tsx` — add the new route, protected to admin / case_manager / org_admin.
- Edit `src/pages/admin/AdminStudentSubmissions.tsx` — pass `defaultTab` from `?tab=` so admin links also land on the right tab.

No database, RLS, or edge function changes — existing per-student hooks already enforce access.
