## Goal
Make the Survey Responses page behave reliably when an admin clicks **Resend**:
- show a visible confirmation/error notification every time
- reset the pending row’s **Sent** date and **day count** immediately after a successful resend

## What I’ll change
1. **Make resend notifications explicit and reliable**
   - Replace the current `toast.promise(...)` flow in `src/pages/admin/SurveyResponses.tsx` with an explicit loading/success/error sequence.
   - This avoids relying on promise-toast behavior and ensures the user always sees feedback after clicking **Resend**.

2. **Update the pending row immediately after resend**
   - In `src/hooks/useSurveyInvitations.ts`, update the cached `pending-invitations-all` data on resend success so the matching invitation row gets:
     - `email_sent_at = now`
     - `email_status = 'sent'` when delivery succeeds
   - Keep the existing refetch/invalidation too, so the UI is both immediate and server-confirmed.

3. **Keep the day count driven by the most recent send time**
   - Keep `email_sent_at ?? created_at` as the source for:
     - the **Sent** column
     - the **Today / Xd** badge
   - This ensures resends restart the clock instead of showing the original invite age.

4. **Refresh related survey lists after resend**
   - Invalidate the recent survey list as well so any “recently sent” summary stays in sync with reminder activity.

## Files
- `src/pages/admin/SurveyResponses.tsx`
- `src/hooks/useSurveyInvitations.ts`

## Technical details
- The backend function already updates `email_sent_at` on successful resend, so no schema change is needed.
- The main reliability improvement is to stop depending only on a refetch to show the new timestamp.
- The resend mutation will optimistically patch the affected invitation in React Query cache, then revalidate from the backend.
- Notification copy will reflect the actual result returned by the resend function (`delivered`, `failed`, or `no email on file`).