## Goal

Move the student check-in from the current 3-week ad-hoc cadence to a fully automated **weekly** cycle: an email goes out every week, and when a student logs in without a completed check-in for the current week, they see a reminder banner that gets more prominent the longer it stays incomplete.

## What changes for users

- **Students** receive one check-in email every Monday morning (their local time-of-day approximated to a single global send window). If they don't complete it, they get a reminder email 3 days later. On login, a banner prompts them to complete this week's check-in; after 7 days overdue it becomes a blocking-style alert at the top of the dashboard.
- **Case managers / admins** see no new UI — existing check-in history views keep working. Admins get a new "Check-in reminders" toggle in Notification Admin Controls so they can pause the automation site-wide if needed.

## How it works

### 1. Cadence change (3 weeks → 1 week)
- Update the dashboard banner threshold in `src/pages/Dashboard.tsx` from 21 days to 7 days.
- Add a second "overdue" state (≥ 14 days) that renders a stronger destructive-style alert.
- Update banner copy from "3-week check-in" to "weekly check-in".

### 2. Rewrite `send-checkin-reminders` edge function
- Change the eligibility window from 21 days to 7 days for the first nudge, plus a second pass for students whose last check-in is ≥ 10 days old (3-day follow-up).
- Skip students whose account is < 7 days old, who are deactivated, or whose org is suspended.
- Respect the existing `site_settings` notification toggles (add a new `checkin_reminders_enabled` key, default `true`).
- Log every send to `email_send_log` with `template_name = 'weekly-checkin-reminder'` and an idempotency key of `checkin-<student_id>-<ISO week>` so the same student never gets two "first nudge" emails in one week even if the cron runs twice.
- Switch the email body to a branded React-Email template (Forest Green / Sage, matches existing transactional emails) routed through the Lovable email queue instead of the current inline Resend call.

### 3. Schedule it weekly with pg_cron
- Enable `pg_cron` + `pg_net` (already enabled for the email queue).
- Schedule two jobs via `cron.schedule`:
  - `weekly-checkin-monday-9am` — every Monday 14:00 UTC (~9am ET) → first nudge.
  - `weekly-checkin-thursday-9am` — every Thursday 14:00 UTC → 3-day follow-up for anyone still missing.
- Both call the `send-checkin-reminders` function via `net.http_post` with the service-role-protected anon key header.

### 4. Login banner refinement
- `src/pages/Dashboard.tsx` already renders a check-in banner; split it into:
  - **Due** (no check-in for ≥ 7 days) → accent-colored card, dismissible for 24h via localStorage.
  - **Overdue** (≥ 14 days) → destructive variant, not dismissible, anchored at the top.
- Also surface a small badge in the sidebar nav next to "Check-in" when due.

### 5. Admin pause switch
- Add `checkin_reminders_enabled: boolean` to `site_settings` (default `true`).
- Add a toggle in the existing Notification Admin Controls page; the edge function reads it on every run and exits early when off.

## Technical details

- Files touched:
  - `supabase/functions/send-checkin-reminders/index.ts` — rewrite to weekly + queued template + idempotency.
  - `supabase/functions/_shared/transactional-email-templates/weekly-checkin-reminder.tsx` — new React Email template.
  - `supabase/functions/_shared/transactional-email-templates/registry.ts` — register template.
  - `supabase/migrations/<ts>_weekly_checkin_cron.sql` — `site_settings` key + RLS already exists; no schema additions besides the settings row.
  - Insert (not migration) the two `cron.schedule` rows via `supabase--insert` since they contain the project-specific function URL + anon key.
  - `src/pages/Dashboard.tsx` — banner threshold + overdue variant.
  - `src/components/layouts/SidebarLayout.tsx` — "due" dot on Check-in nav item (student only).
  - `src/pages/admin/...` (Notification Admin Controls component) — add toggle wired to `site_settings`.
- Email content uses the existing queued `send-transactional-email` invocation pattern (idempotency key, suppression list honored, unsubscribe footer auto-appended).
- The 7-day window is computed in UTC against `student_checkins.created_at` to match the dashboard logic.

```text
Monday 14:00 UTC ──► send-checkin-reminders ──► queue "first nudge" for students with no check-in in 7+ days
Thursday 14:00 UTC ─► send-checkin-reminders ──► queue "follow-up" for students still missing at 10+ days
Student logs in    ─► Dashboard reads latest check-in
                     ├─ < 7d   → no banner
                     ├─ 7-13d  → accent banner, dismissible 24h
                     └─ ≥ 14d  → red overdue alert, persistent
```

## Open question

Should the **first** weekly email go out to every existing student next Monday, or should we phase it in by only emailing students whose last check-in is already ≥ 7 days old (avoiding a sudden blast to students who happened to check in recently)? I'd recommend the phased approach — same code, just a gentler rollout.
