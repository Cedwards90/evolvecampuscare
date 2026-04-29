## Goal
Add bulk student invite (CSV upload + multi-email paste) and an enhanced survey distribution flow with multi-select recipients, scheduling, and tracking — without changing any existing single-invite or single-survey logic.

## Scope rules (no regressions)
- Do NOT modify `useInvitations.ts`, `useSurveyInvitations.ts`, `InviteUserDialog.tsx`, `SendSurveyDialog.tsx`, `BulkCohortSurveyDialog.tsx`, `send-user-invitation`, or `send-survey-invitation`. New code only.
- All new UI is additive: a "Bulk Invite Students" button next to the existing "Invite User" button on `UserManagementPage`, and a "Distribute Survey" button on `SurveyResponses`.

---

## 1. Bulk student invite (Admin only, ≤100 per batch)

### New component: `src/components/admin/BulkInviteStudentsDialog.tsx`
- Two-tab dialog: **CSV Upload** and **Paste Emails**.
- **CSV tab**: drag-drop or file picker. Accepts `.csv` with one email per row (optional `email,full_name,organization` headers). Parse client-side with a tiny inline parser (no new deps). Preview first 5 rows + "X valid, Y invalid, Z duplicates".
- **Paste tab**: textarea, comma/newline-separated emails.
- **Validation**: zod email check, normalize (trim + lowercase), dedupe within batch, dedupe against existing pending `user_invitations` (query before submit), cap at 100. Invalid rows shown in a collapsible list with reason.
- **Optional fields**: organization dropdown (from `useActiveOrganizations`), shared note. Role is hardcoded to `student`.
- **Submit**: calls new edge function `bulk-invite-students` with the validated array. Shows progress bar (`processed / total`) updated by polling the returned job row, plus per-email status table (pending → sent / failed / skipped) once complete. Success/error toasts + summary modal.

### New edge function: `supabase/functions/bulk-invite-students/index.ts`
- CORS + auth + MFA (admin-only check via `user_roles`).
- Accepts `{ emails: [{ email, fullName?, organizationId? }], notes?, organizationId? }`, max 100.
- Inserts a row in new `bulk_invite_jobs` table with `total`, `processed=0`, `status='processing'`.
- For each email: generate token (reuse logic from `generate-invitation-token` via `supabase.functions.invoke`), send email (invoke `send-user-invitation`), append result to `bulk_invite_job_items`, increment `processed`. Wraps each in try/catch so one failure doesn't kill the batch.
- Returns `{ jobId }` immediately if `>20` emails (background via `EdgeRuntime.waitUntil`); otherwise awaits and returns full result.

### New table: `bulk_invite_jobs` + `bulk_invite_job_items` (migration)
- `bulk_invite_jobs`: id, created_by, total, processed, succeeded, failed, skipped, status (`processing`/`complete`/`failed`), notes, created_at, completed_at.
- `bulk_invite_job_items`: id, job_id (FK), email, status (`pending`/`sent`/`failed`/`skipped`), error, invitation_id (nullable), created_at.
- RLS: admins manage all; case_managers/students no access.

### New hook: `src/hooks/useBulkInvite.ts`
- `useBulkInvite()` mutation invoking the edge function.
- `useBulkInviteJob(jobId)` query polling the job row + items every 2s while `status === 'processing'`.

### UI integration
- `src/pages/admin/UserManagementPage.tsx`: add "Bulk Invite" button next to "Invite User".

---

## 2. Survey distribution from survey screen

### New component: `src/components/admin/DistributeSurveyDialog.tsx`
- Triggered by a new **"Distribute Survey"** button on `SurveyResponses.tsx` (Pending tab header).
- **Step 1 — Survey type**: select `checkin` or `post_graduation_plan`.
- **Step 2 — Recipients**: searchable, multi-select student list with checkboxes. Filters: cohort, organization, "has email", "no pending of this type". Group quick-picks: "All students", "Selected cohort", "Selected org". Shows live count.
- **Step 3 — Schedule**: radio — **Send now** or **Schedule for later** (date+time picker, future only). Optional shared note.
- **Step 4 — Confirm**: summary card with recipient count, type, scheduled time, note. "Send now" / "Schedule" button.
- Permission: admin or case_manager (case_managers see only their assigned students — applied via existing RLS on student fetch).

### New table: `scheduled_survey_distributions` (migration)
- Columns: id, created_by, survey_type, recipient_ids (uuid[]), notes, scheduled_for (timestamptz), status (`scheduled`/`processing`/`complete`/`cancelled`), processed_count, created_at, completed_at.
- RLS: creator + admin can view; admin can update/cancel.

### New edge function: `supabase/functions/distribute-survey/index.ts`
- CORS + auth + MFA + role check (admin/case_manager).
- Accepts `{ surveyType, recipientIds, notes?, scheduledFor? }`.
- **Send now path**: dedupe recipients (skip students with existing incomplete invitation of same type, matches existing cohort dialog behavior), insert `survey_invitations` rows, then invoke `send-survey-invitation` (existing — unchanged) for the dedupe'd list. Returns send results.
- **Scheduled path**: insert into `scheduled_survey_distributions` with `status='scheduled'`. Returns `{ scheduledId }`.

### New edge function: `supabase/functions/process-scheduled-surveys/index.ts`
- Cron-triggered (every 5 min). Finds rows where `status='scheduled'` and `scheduled_for <= now()`, marks `processing`, runs the same send-now path, marks `complete`.

### Cron setup
- Use `pg_cron` + `pg_net` to invoke `process-scheduled-surveys` every 5 minutes (separate insert tool call with the project URL + anon key, not in migration).

### Tracking ("sent" + "completed")
- The existing `survey_invitations` table already tracks `email_sent_at`, `email_status`, and `completed_at`. The Pending tab on `SurveyResponses` already shows these.
- Add a new **"Distributions"** tab on `SurveyResponses.tsx` listing scheduled + recently-sent distributions with their summary stats: `sent / failed / skipped / completed (n/total)`. Cancel button for `scheduled` rows. "Opened" tracking is explicitly out of scope.

### New hook: `src/hooks/useSurveyDistribution.ts`
- `useDistributeSurvey()` mutation.
- `useScheduledDistributions()` query.
- `useCancelScheduledDistribution()` mutation.

---

## 3. UX feedback (both flows)
- Loading: button spinner + disabled state during submit; progress bar for bulk invites.
- Errors: zod field errors inline; per-row error list in expandable section; toast for global failures.
- Success: confirmation modal showing counts (sent / failed / skipped / scheduled).
- Permission denied: friendly message if non-admin/non-staff opens the dialog.

---

## Files
**New**
- `src/components/admin/BulkInviteStudentsDialog.tsx`
- `src/components/admin/DistributeSurveyDialog.tsx`
- `src/hooks/useBulkInvite.ts`
- `src/hooks/useSurveyDistribution.ts`
- `supabase/functions/bulk-invite-students/index.ts`
- `supabase/functions/distribute-survey/index.ts`
- `supabase/functions/process-scheduled-surveys/index.ts`

**Edited (additive only — buttons + new tab)**
- `src/pages/admin/UserManagementPage.tsx` — add Bulk Invite button
- `src/pages/admin/SurveyResponses.tsx` — add Distribute Survey button + Distributions tab

**Untouched (explicit no-change list)**
- `src/hooks/useInvitations.ts`, `src/hooks/useSurveyInvitations.ts`
- `src/components/admin/InviteUserDialog.tsx`, `SendSurveyDialog.tsx`, `BulkCohortSurveyDialog.tsx`
- `supabase/functions/send-user-invitation`, `send-survey-invitation`, `generate-invitation-token`

---

## Migrations summary
- Create `bulk_invite_jobs`, `bulk_invite_job_items` with admin-only RLS.
- Create `scheduled_survey_distributions` with creator+admin RLS.
- Enable `pg_cron` and `pg_net` if not already enabled (separate insert call to schedule the cron, not in migration).
