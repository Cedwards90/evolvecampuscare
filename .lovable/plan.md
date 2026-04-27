## Problem
The "days" badge in the Pending Surveys table is calculated from `invitation.created_at`, which never changes. When you click **Resend**, the row still shows the same age (e.g. `9d`) even though a fresh email just went out. The "Sent" date column has the same issue.

## Fix
Use the most recent send timestamp (`email_sent_at`) — falling back to `created_at` for invitations that haven't been emailed yet — for both the "Sent" date and the days-elapsed badge. The `send-survey-invitation` edge function already updates `email_sent_at` on every successful send (initial and resend), so the row will refresh automatically once the React Query cache invalidates after the resend mutation.

```ts
// Before
const days = Math.floor((Date.now() - new Date(invitation.created_at).getTime()) / 86400000);

// After
const lastSentAt = invitation.email_sent_at || invitation.created_at;
const days = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000);
```

The "Sent" cell switches from `invitation.created_at` to `lastSentAt` for the same reason.

## Files

| File | Change |
|---|---|
| `src/pages/admin/SurveyResponses.tsx` | In `PendingRow`, derive `lastSentAt = email_sent_at ?? created_at` and use it for both the days badge and the Sent date column |

## Notes
- No backend / schema changes — `email_sent_at` is already populated by the edge function and already returned by `usePendingInvitations`.
- The existing `queryClient.invalidateQueries({ queryKey: ['pending-invitations-all'] })` in `useResendInvitation` will refetch and re-render the row with the new timestamp immediately after a resend.
