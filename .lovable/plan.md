

## Problem
Two issues with survey send:
1. **No email is ever sent.** `useSendSurvey`, `BulkCohortSurveyDialog`, and `useResendInvitation` only insert into `notifications` and `survey_invitations`. They never call any email function.
2. **No portal confirmation of dispatch.** A toast fires after send, but there is no visible "Sent Surveys" / "Pending Surveys" panel on the Send dialogs themselves, and the Admin Survey Responses "Pending" tab silently auto-heals invitations that were submitted within 1 day, making it look like nothing was sent for cohorts that already completed.

## Fix

### 1. Send actual emails on every survey invitation
- Create a new edge function `send-survey-invitation` that:
  - Verifies caller via `auth.getUser(token)` (apply the same explicit-token pattern used in the recent `notify-status-change` fix to avoid 401s).
  - Accepts `{ studentIds: string[], surveyType: 'checkin' | 'post_graduation_plan', notes?: string, isReminder?: boolean }`.
  - Looks up each student's `profiles.email` + `full_name` via service-role client.
  - Checks `site_settings` (existing notification toggles) before sending — respect admin opt-outs.
  - Sends one branded email per student via Resend (Evolve Foundation forest-green styling, matching `notify-status-change`), with subject and CTA differing for `checkin` vs `post_graduation_plan` and "Reminder" prefix when `isReminder=true`.
  - CTA link → `${SITE_URL}/check-in` or `/post-graduation-plan`.
  - Returns `{ sent, failed, skipped }`.
  - Strict CORS, `sanitizeError`, no PII in error responses (per `edge-function-security` memory).

- Wire it up:
  - `useSendSurvey` → after inserting invitation + notification, invoke `send-survey-invitation` with `[studentId]`.
  - `BulkCohortSurveyDialog` → after bulk insert, invoke with the full `toSend` list (one call, server fans out).
  - `useResendInvitation` → invoke with `isReminder: true`.
  - All invocations are best-effort — if email fails, the in-app notification still stands and a toast surfaces "Sent N invites · M emails delivered".

### 2. Portal confirmation that surveys went out
- **Sent toast → richer**: change success toasts to show counts ("Sent to 10 students · 10 emails queued · 0 skipped").
- **New "Recently Sent" section** in `src/pages/admin/SurveyResponses.tsx` Pending tab header: shows last 7 days of invitations grouped by `created_at` batch (cohort + survey type + count + sender), regardless of completion. This makes bulk sends visibly logged even when students complete immediately.
- **Tighten auto-heal grace window**: change the 1-day backward grace in `usePendingInvitations` to 1 hour. The original 1-day window was a one-time fix for the bulk-send-after-submit incident; keeping it permanently makes legitimate fresh sends disappear instantly if the student happened to submit earlier that day. With real emails going out, 1 hour is enough.
- **`PendingRow` shows "Email: delivered/failed/pending"** badge per row, fed from a new `email_status` column.

### 3. Schema: track email delivery per invitation
Add to `survey_invitations`:
- `email_sent_at timestamptz null`
- `email_status text null` — values: `pending`, `sent`, `failed`, `skipped_no_email`, `disabled_by_admin`
- `email_error text null`

The edge function updates these columns after each Resend call. The Pending tab and the Recently Sent section read them so admins can see "10 sent, 1 failed (no email on file)".

### 4. Email template content
- **Check-In email**: subject "Time for your 3-week check-in", body explains it's a quick mood/progress survey, primary button "Complete Check-In".
- **Post-Graduation Plan email**: subject "Your 12-month post-graduation plan", body explains purpose, button "Start My Plan".
- **Reminder variant**: prefixes subject with "Reminder: " and adds "We noticed you haven't completed this yet" line.
- Footer: "You're receiving this because your case manager at Evolve Foundation requested it." Forest-green `#054D3B` header, sage `#88A98C` accents, pill button — matches existing Evolve email styling.

## Files

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Add `email_sent_at`, `email_status`, `email_error` to `survey_invitations` |
| `supabase/functions/send-survey-invitation/index.ts` | New edge function (Resend + auth + per-row status updates) |
| `supabase/functions/send-survey-invitation/deno.json` | Deno config |
| `supabase/config.toml` | Register function (default `verify_jwt`) |
| `src/hooks/useSurveyInvitations.ts` | Invoke edge function from `useSendSurvey` and `useResendInvitation`; return `{ sent, failed }` |
| `src/components/admin/BulkCohortSurveyDialog.tsx` | Invoke edge function with batch `toSend`; richer toast |
| `src/components/admin/SendSurveyDialog.tsx` | Richer success toast |
| `src/hooks/useSurveyResponses.ts` | Pending tab includes `email_status`; tighten auto-heal grace from 24h → 1h |
| `src/pages/admin/SurveyResponses.tsx` | Add "Recently Sent (last 7 days)" section above Pending table; show email-status badge in `PendingRow` |

## Notes
- No new secrets — `RESEND_API_KEY` already configured.
- No RLS changes — admin/case-manager already manage `survey_invitations`; the edge function uses service-role for the column updates.
- Existing `notifications` insert stays in place so the in-app bell still fires alongside email.
- Respects existing admin notification toggles in `site_settings`.

