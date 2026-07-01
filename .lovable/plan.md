## Goal
Enable **per-student survey sending** for all survey types and let **admins delete any survey submission**.

## 1. Send surveys to individual students

### Life Skills surveys (`SendLifeSkillsDialog`)
Add a third "Send to" mode: **Individual student**.
- New radio option "A specific student" alongside Cohort / Organization.
- Student picker (searchable Combobox) using existing `useStudentFolders`/similar hook, scoped to what the current user can see (admin = all, org_admin = their orgs, case_manager = assigned students).
- Update `send-lifeskills-survey` Edge Function to accept `student_id` and, when provided, assign + email only that one student (bypass cohort/org query).

### Check-In / Post-Grad surveys (`SendSurveyDialog`)
Already sends to one student — no change needed. Add a matching entry point on the Surveys index card so staff can pick a student without going through the Student Detail page:
- New "Send to student…" button on each Check-In and Post-Grad card in `SurveysIndex.tsx` → opens a lightweight dialog that first picks a student, then reuses `SendSurveyDialog` logic.

### Intake / Career Intake
These are self-serve onboarding surveys; add a "Request from student" action that creates a `survey_invitations` row + notification (mirrors check-in flow) so staff can nudge one student.

## 2. Admin delete of submissions

Submission tables involved:
- `student_checkins`
- `post_graduation_plans`
- `intake_responses`
- `career_intake_responses`
- `impact_survey_responses` (Life Skills)
- `survey_invitations` (the request itself)

### Database
Migration adding admin DELETE RLS policies to any of the above missing one (audit each; most already allow admin via existing policies — confirm and patch gaps only). No schema changes.

### UI
`SubmissionsTabs` already has an `allowDelete` mode used by `AdminStudentSubmissions`. Extend it:
- Add Life Skills responses tab delete affordance (currently read-only there).
- Add a **"View completions" → row action → Delete** in `SurveyCompletionsDialog` for admins (opens confirm, calls delete on the underlying row(s), invalidates queries).
- Add per-submission delete button in `MySubmissions`/admin views wherever an entry currently lacks one.

All deletes gated by `role === 'admin'` on the client and by RLS on the server.

## Files to change

**Frontend**
- `src/components/admin/SendLifeSkillsDialog.tsx` — add Individual mode + student picker
- `src/pages/admin/SurveysIndex.tsx` — add "Send to student" action on Check-in/Post-Grad/Intake cards
- `src/components/admin/SendSurveyDialog.tsx` — allow opening without a preset student (picker inside)
- `src/components/admin/SurveyCompletionsDialog.tsx` — admin delete action per row
- `src/components/submissions/SubmissionsTabs.tsx` — ensure delete works for Life Skills responses tab
- `src/hooks/useLifeSkillsSurveys.ts` — pass `student_id` through `sendLifeSkillsSurvey`

**Backend**
- `supabase/functions/send-lifeskills-survey/index.ts` — support single `student_id`
- New migration — admin DELETE policies on any submission table lacking one (audit first)

## Out of scope
- Bulk multi-student picker (single student only for this pass)
- Undo / soft-delete (hard delete with confirm dialog)
