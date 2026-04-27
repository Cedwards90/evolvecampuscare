## Problem
Clicking **Resend** in the Pending Surveys table does nothing. Two compounding bugs:

1. **RLS blocks the notification insert.** `useResendInvitation` does:
   ```ts
   await supabase.from('notifications').insert({ user_id: studentId, ... })
   ```
   The `notifications` INSERT policy is `auth.uid() = user_id`, so an admin/case manager cannot create a notification *for* a student. The insert returns an RLS error, the hook calls `throw error`, and the email dispatch never runs. (The edge function logs confirm `send-survey-invitation` has never been invoked from a Resend click.)

2. **The error is swallowed.** The Resend button only passes `onSuccess` to `mutate(...)` — no `onError`, no toast. The mutation rejects, React Query logs it, and the UI shows nothing. From the user's perspective the click is dead.

`useSendSurvey` (the initial Send) has the same RLS issue but happens to mask it because it doesn't `throw` on the notification insert error — so emails still go out for new sends. Resend is the only broken path.

## Fix

### 1. Make the notification insert non-fatal in `useResendInvitation`
Match the pattern used by `useSendSurvey`: best-effort the in-app notification (log on failure, don't throw), then always invoke the email edge function. This unblocks the email pipeline regardless of the RLS situation.

### 2. Route notification inserts through an edge function (proper fix)
The real fix for both Send and Resend is to insert the student-facing notification with the service role from inside `send-survey-invitation`. The edge function already has the student lookup and runs with elevated privileges, so it can:
- Insert the `notifications` row for the student (bypassing RLS cleanly)
- Then send the email

Remove the client-side `notifications.insert` from both `useSendSurvey` and `useResendInvitation`, and let the edge function own it. This eliminates the RLS workaround and guarantees the in-app bell + email stay in sync.

### 3. Surface errors on the Resend button
Add `onError` to the `resend.mutate(...)` call in `PendingRow` so failures show a toast (`"Failed to send reminder"`) instead of looking dead. Also surface the email-dispatch result in the success toast (`"Reminder sent · email delivered"` / `"… email failed"` / `"… no email on file"`), matching `SendSurveyDialog`.

## Files

| File | Change |
|---|---|
| `supabase/functions/send-survey-invitation/index.ts` | Insert `notifications` row per student (with service role) before/after sending email; accept `isReminder` to vary title/message |
| `src/hooks/useSurveyInvitations.ts` | Remove client-side `notifications.insert` from `useSendSurvey` and `useResendInvitation`; rely on edge function |
| `src/pages/admin/SurveyResponses.tsx` | Add `onError` toast to Resend button; expand success toast with email delivery status |

## Notes
- No schema changes, no RLS changes.
- In-app notifications and email dispatch become a single atomic-ish operation owned by the edge function — fixes a long-standing silent RLS failure on the original Send path too.
- The edge function is already deployed and authenticated; only its body needs updating, then redeploy.
