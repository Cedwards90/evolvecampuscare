## Problem

Confirmed in the database: students have up to **4 open invitations** for the same Life Skills survey (e.g. `lifeskills:lifeskills-m02-pre`). Root causes:

1. `survey_invitations` has no uniqueness constraint, so every "Send" click (before the `skip_already_sent` flag existed) inserted a new open row.
2. The student **Dashboard** renders `pendingSurveys.map(...)` directly, so one template with 4 rows shows as 4 cards.
3. `useSendSurvey` (individual sends for check-in / intake / etc.) has no duplicate guard at all.

The Surveys page itself is fine — it lists assignments (already unique per template) — but the dashboard reminder banner is the visible duplication.

## Fix

### 1. Database migration
- Clean up existing duplicates: for each `(student_id, survey_type)` with `completed_at IS NULL`, keep the newest row, mark older rows as `completed_at = now()` with a note (preserves audit history without breaking foreign keys).
- Add a **partial unique index** `survey_invitations (student_id, survey_type) WHERE completed_at IS NULL` so only one open invitation per (student, survey type) can exist going forward.

### 2. Edge function `send-lifeskills-survey`
- Change the `survey_invitations` insert to an upsert with `onConflict: student_id,survey_type` and `ignoreDuplicates: true` so a race or a re-send never errors, it just skips.
- Keep the existing `skip_already_sent` pre-filter (already defaults to true).

### 3. `useSendSurvey` hook (individual sends)
- Before inserting, check for an existing open invitation of the same `survey_type` for that student; if one exists, skip the insert and the duplicate notification, and return a "already pending" result the caller can toast.

### 4. Dashboard rendering
- Dedupe `pendingSurveys` client-side by `survey_type`, keeping the most recent, so even if legacy data slips through the student sees one card per survey.

## Technical notes
- Partial unique index is the correct shape because completed invitations are historical and should remain multiple.
- Assignments (`impact_survey_assignments`) already have `onConflict: student_id,template_id`, no change needed.
- No schema change to `notifications` — those aren't rendered as survey cards.
