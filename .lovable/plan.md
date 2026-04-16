

## Plan: Survey Responses Viewer for Staff

### Overview
Create a dedicated page (`/admin/surveys`) where admins and case managers can browse all submitted check-ins and post-graduation plans across students in one centralized view, with filtering by survey type, student name, and date range.

### Changes

**1. `src/pages/admin/SurveyResponses.tsx`** — New page
- Tabs: "Check-Ins" and "Post-Graduation Plans"
- Check-Ins tab: table listing all check-ins with student name, date, mood, progress ratings, and expandable detail rows for wins/blockers/notes
- Post-Grad Plans tab: table/card list with student name, submission date, graduation date, and expandable sections for goals and milestones
- Search bar to filter by student name
- Links to student detail page from each row
- Uses existing `useStudentCheckIns` pattern but queries all accessible records (new hooks)

**2. `src/hooks/useSurveyResponses.ts`** — New hook
- `useAllCheckIns()` — fetches `student_checkins` joined with `profiles` (student name), respecting existing RLS (case managers see assigned, admins see all)
- `useAllPostGradPlans()` — fetches `post_graduation_plans` joined with `profiles`, same RLS
- `useAllSurveyInvitations()` — fetches `survey_invitations` joined with profiles for the invitation history/status view

**3. `src/App.tsx`** — Add route `/admin/surveys` for `case_manager` and `admin` roles

**4. `src/components/layouts/SidebarLayout.tsx`** — Add "Surveys" nav item for case_manager and admin roles (using ClipboardList icon)

### File Summary

| File | Action |
|------|--------|
| `src/hooks/useSurveyResponses.ts` | Create — cross-student query hooks |
| `src/pages/admin/SurveyResponses.tsx` | Create — survey viewer page |
| `src/App.tsx` | Add route |
| `src/components/layouts/SidebarLayout.tsx` | Add nav item |

No database or RLS changes needed — existing policies already grant the correct access.

