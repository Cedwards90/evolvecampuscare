## Goal
Add bulk-send capability to every non-Life-Skills survey (Weekly Check-In, Post-Graduation Plan, Intake, Career Intake) so staff can send by cohort or entire organization in one click — matching the Life Skills flow.

## Current State
- `SendLifeSkillsDialog` already supports **Cohort / Organization / Individual student** modes with a "skip already sent" toggle and a summary toast — powered by the `send-lifeskills-survey` Edge Function.
- `SendSurveyDialog` (used for all other surveys) only supports a single student picker; `useSendSurvey` inserts one `survey_invitations` row + one `notifications` row.
- Both flows already dedupe against open (`completed_at IS NULL`) invitations per (student, survey_type).

## Changes

### 1. `SendSurveyDialog.tsx` (UI)
- Add the same "Send to" radio group: **A cohort / An entire organization / A specific student**.
- Show `Cohort` / `Organization` / `StudentPicker` conditionally, reusing `useAllCohorts` + `useActiveOrganizations` (already used by Life Skills dialog).
- Keep existing preset-student mode (`studentId` prop) — when preset, hide the radio and force "student" mode so student-detail pages behave unchanged.
- Add the "Only send to students who haven't received this survey yet" checkbox (default on).
- Show a summary toast: `X assigned · Y skipped (already invited)` — mirroring Life Skills wording.

### 2. `useSurveyInvitations.ts` (logic)
- Extend `useSendSurvey` to accept `{ mode, cohortId?, organizationId?, studentIds?, surveyType, notes, skipAlreadySent }`.
- Resolve target student list client-side:
  - `cohort`: `profiles` where `cohort_id = X` and role = student (via `user_roles`).
  - `organization`: active `organization_memberships` for the org, role = student.
  - `student`: the single id passed in.
- If `skipAlreadySent`, filter out students with an open invitation for that `survey_type` using a single `IN` query against `survey_invitations`.
- Bulk insert remaining rows into `survey_invitations` and matching rows into `notifications` (reuse existing title/message/link map).
- Return `{ assigned, skipped }` for the toast.

### 3. No schema, RLS, or Edge Function changes
- Existing unique index on (student_id, survey_type) where `completed_at IS NULL` already prevents true duplicates at the DB level.
- Staff already have INSERT rights on `survey_invitations` and `notifications` per current policies (verified via existing single-send path).

### 4. Non-goals / untouched
- Life Skills flow untouched.
- No email sending added for these surveys — they continue to use in-app notifications only (matching current behavior). If email is wanted too, that's a follow-up.
- No changes to `SurveysIndex`, admin pages, or other callers — `SendSurveyDialog`'s existing API is preserved (adding optional props only).

## Files
- `src/components/admin/SendSurveyDialog.tsx` — add mode selector + bulk fields.
- `src/hooks/useSurveyInvitations.ts` — extend `useSendSurvey` to handle bulk targets.
