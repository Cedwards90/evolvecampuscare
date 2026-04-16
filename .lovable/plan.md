

### Problem
The Pending tab on `/admin/surveys` shows students who have **already completed** their check-in or post-grad plan. Confirmed in DB:
- 2 students (Diarra Stinson, Shavez Moody) submitted check-ins at 16:47 / 17:20.
- All `survey_invitations.completed_at` are NULL because the bulk send (21:08) happened *after* their submissions.
- `useMarkSurveyComplete` only fires at submit-time, so it can't retroactively mark invites that didn't yet exist.
- Going forward, even new completions would only mark *one* invite per student per type — bulk-sent duplicates stay stuck as "pending".

### Fix: derive completion from actual submissions, not just the `completed_at` flag

Update `usePendingInvitations()` in `src/hooks/useSurveyResponses.ts` to:
1. Fetch all `survey_invitations` where `completed_at IS NULL` (as today).
2. Also fetch:
   - `student_checkins` rows (student_id + created_at) for any student in the invite list.
   - `post_graduation_plans` rows (student_id + created_at) for any student in the invite list.
3. **Filter out** any invitation where the student has a matching submission of that `survey_type` with `created_at >= invitation.created_at - 1 day` (1-day grace covers the bulk-send-after-submit case the user just hit).
   - `checkin` → match against `student_checkins`
   - `post_graduation_plan` → match against `post_graduation_plans`
4. Return only the truly-pending list. Counts in the tab badge auto-correct.

### Bonus: auto-mark them complete
For invites we filter out as already-submitted, fire-and-forget an `update` setting `completed_at` to the submission time. This cleans up the data so future queries are fast and accurate, and it also fixes the student-side `usePendingSurveys` reminder list.

### Files
| File | Change |
|---|---|
| `src/hooks/useSurveyResponses.ts` | Update `usePendingInvitations` to cross-check submissions + auto-heal `completed_at` |

### Notes
- No schema changes, no RLS changes (admin already has full update on `survey_invitations`).
- Brand & UI untouched — the existing Pending tab simply shows a smaller, accurate list.

