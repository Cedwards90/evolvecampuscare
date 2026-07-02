# Fix: Guided tour keeps popping up + duplicate survey requests

## Problem 1: Guided tour re-appears repeatedly

Root causes in `src/hooks/useProductTour.ts`:

1. **Hook is mounted in 4 places** (`Dashboard`, `Settings`, `HelpButton`, `GettingStartedSection`). Each instance runs its own auto-start `useEffect` + login-count increment, so on every navigation the login counter re-increments and the auto-start effect fires again.
2. **Closing (skip) never persists any dismissal.** `onCloseClick` just destroys the driver — next mount sees no completion flag and re-triggers after 1.5s.
3. **No cross-instance guard.** Even inside one page, remounts (route change, filter change) re-arm the 1.5s auto-start timer.

## Fix

Edit `src/hooks/useProductTour.ts` only:

- Add **module-level singletons**: `autoStartedThisSession: boolean` and `loginCountedThisSession: Set<userId>`. Guard the auto-start effect and login-count effect with these so they run at most once per browser tab session, no matter how many components call the hook.
- Add a **per-user "dismissed" flag** in storage (`evolve:tour-dismissed:${userId}`) written from `onCloseClick` and checked alongside the completion flag in the auto-start effect and the migration effect. The Help menu "Replay guided tour" clears this flag (via `resetTour`, which will also remove the dismissed key) so users can always re-open it manually.
- Keep `startTour` (manual) unchanged so the Help button still works on demand.

Result: tour auto-starts once per new user, and if they X out it stays closed until they click "Replay guided tour."

## Problem 2: Resending a survey sends to students who already received it

In `supabase/functions/send-lifeskills-survey/index.ts`, recipient resolution never filters out students who already have an open `survey_invitations` row (or an active `impact_survey_assignments` row) for this template. So re-clicking "Send" duplicates invitations, notifications, and emails.

## Fix

- Add optional `skip_already_sent: boolean` (default **true**) to `BodySchema`.
- After resolving `recipientIds` and before the send loop, when `skip_already_sent` is true:
  - Query `survey_invitations` for rows where `student_id IN recipientIds AND survey_type = 'lifeskills:{slug}' AND completed_at IS NULL`.
  - Remove those student_ids from `recipientIds`, count them into `skipped`.
- Return the skipped count in the response so the UI can show e.g. "Sent to 8, skipped 12 already-invited students."
- Update `src/hooks/useLifeSkillsSurveys.ts` `sendLifeSkillsSurvey` typing to include the new field and the returned counts (already typed loosely, just add `skip_already_sent?: boolean`).
- Update the bulk-send UI (`src/pages/admin/LifeSkillsSurveys.tsx` — the "Send" dialog that calls `sendLifeSkillsSurvey`) with a checkbox **"Only send to students who haven't received this survey yet"**, checked by default, and surface the returned `skipped` count in the success toast.

Individual `SendSurveyDialog` (single-student) is unaffected — it's an explicit one-off send.

## Files touched

- `src/hooks/useProductTour.ts` — module-level session guards + dismissed flag.
- `supabase/functions/send-lifeskills-survey/index.ts` — filter out open invitations; deploy after edit.
- `src/hooks/useLifeSkillsSurveys.ts` — extend payload/return types.
- `src/pages/admin/LifeSkillsSurveys.tsx` (the bulk-send dialog) — checkbox + toast copy.
