

User is on `/admin/surveys` and wants to see pending (sent but not completed) survey invitations after dispatch.
<lov-tool-use id="toolu_vrtx_01GaDpooa2MYdC96RivAM88V" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/admin/SurveyResponses.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019gV5XDJ4siwm95fBZKW8aQ" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/admin/SurveyResponses.tsx\"}">
</lov-tool-use>
<lov-plan>

User is on `/admin/surveys` and wants to see surveys that have been **sent but not yet completed** (pending invitations).

### Plan: Add "Pending" tab to Survey Responses page

#### 1. New hook
Add `usePendingInvitations()` to `src/hooks/useSurveyResponses.ts` — selects from `survey_invitations` where `completed_at IS NULL`, joined to student profile (name/email) and sender profile (sent-by name). Sorted newest first.

#### 2. New tab on `SurveyResponses.tsx`
Add a third tab **"Pending (N)"** alongside Check-Ins and Post-Graduation Plans. Tab contents:
- Table with columns: Student, Survey Type (Check-In / Post-Grad Plan badge), Sent By, Sent Date, Days Pending, Notes, Actions
- "Days pending" shown as a muted badge that turns amber after 7 days, red after 14
- Action: **Resend** button (creates a fresh notification + updates invite timestamp) and **Cancel** button (deletes the row, admin-only)
- Empty state: "No pending surveys."
- Search input already on page filters by student name across all three tabs

#### 3. Cancel/resend mutations
Add to `useSurveyInvitations.ts`:
- `useCancelInvitation()` — deletes the row (admin RLS already covers this via `ALL` policy)
- `useResendInvitation()` — re-inserts a notification row and bumps `created_at` (or inserts a new invitation and deletes the old one — simpler: just create a new notification ping)

### Files
| File | Change |
|---|---|
| `src/hooks/useSurveyResponses.ts` | Add `usePendingInvitations` |
| `src/hooks/useSurveyInvitations.ts` | Add cancel + resend mutations |
| `src/pages/admin/SurveyResponses.tsx` | New "Pending" tab + table |

### Notes
- No schema or RLS changes required
- Case-manager scope not in this plan (page is admin-only); if needed later, filter by assigned students client-side
- Completed invitations naturally disappear from the Pending tab once student submits the survey (existing `useMarkSurveyComplete` already sets `completed_at`)

