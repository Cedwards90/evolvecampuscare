

User wants a way to send surveys to entire cohorts in bulk, not one student at a time.

### Current state
- `SendSurveyDialog.tsx` exists and sends a survey (`survey_invitations` insert) for a single student.
- Students have a `cohort_start_date` field on `profiles`.
- Admins can manage all `survey_invitations`. Case managers can send only to assigned students.

### Plan: Bulk Cohort Survey Dispatch

#### 1. New dialog component
Create `src/components/admin/BulkCohortSurveyDialog.tsx`:
- Survey type select (re-use the same options as `SendSurveyDialog`: intake, satisfaction, post-graduation, etc.)
- Cohort selector — a dropdown of distinct `cohort_start_date` values pulled from `profiles` (formatted as "March 2024 Cohort"), plus an "All students" option
- Optional organization filter (dropdown of `training_organizations`)
- Optional notes textarea
- Preview count: "This will send to **N students**" updated live as filters change
- "Send to N students" submit button with confirmation

#### 2. Mutation logic
- Query `profiles` filtered by selected `cohort_start_date` (and `organization_id` if set), joined to `user_roles` where role = 'student'
- For case managers: further restrict to students in `student_assignments` where `case_manager_id = auth.uid()` (RLS will enforce, but filter client-side too for accurate count)
- Skip students who already have an **incomplete** invitation of the same `survey_type` (avoid duplicates)
- Bulk insert into `survey_invitations` (one row per student)
- Toast: "Sent {survey_type} to {N} students. {M} skipped (already pending)."
- Invalidate `survey-invitations` query

#### 3. Mount the new button
- `src/pages/admin/UserManagementPage.tsx` (or wherever `SendSurveyDialog` is used today) — add a "Send to Cohort" button next to existing actions
- Also expose on the case manager's `MyStudentsSection.tsx` (scoped to their assigned students' cohorts)

### Files
| File | Change |
|---|---|
| `src/components/admin/BulkCohortSurveyDialog.tsx` | NEW dialog with cohort + org filters and bulk insert |
| `src/pages/admin/UserManagementPage.tsx` | Mount "Send to Cohort" button |
| `src/components/casemanager/MyStudentsSection.tsx` | Mount the same button (CM-scoped) |

### Notes
- No schema changes — `survey_invitations` already supports per-student rows
- No new RLS — existing policies already cover both admin and case-manager paths
- No edge function — direct inserts via Supabase client
- Survey types reused from `SendSurveyDialog` to stay consistent

