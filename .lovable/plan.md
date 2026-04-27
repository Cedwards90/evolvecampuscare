## Problem
When clicking **Resend** on a pending survey row, the user sees no confirmation. Toast handlers exist on the mutation (`onSuccess` / `onError`), but:

- The edge function call can take 1–3 seconds — the button just sits there with no immediate feedback.
- If the success result has no `sent`/`failed`/`skipped` (e.g. unexpected response), `toast.success` still fires with just `'Reminder sent'`, but if the request is silently pending the user perceives nothing.
- There's no loading toast bridging the gap.

## Fix

In `src/pages/admin/SurveyResponses.tsx`, wrap the Resend `mutate` call in `toast.promise(...)` so the user sees:
1. Immediate **"Sending reminder..."** toast on click
2. **"Reminder sent · email delivered"** (or appropriate variant) on success
3. **"Failed to send reminder"** on error

Also add the same `toast.promise` pattern to the **Cancel** button for consistency.

### Code change (PendingRow)

```tsx
onClick={() => {
  const promise = resend.mutateAsync({
    studentId: invitation.student_id,
    surveyType: invitation.survey_type,
  });
  toast.promise(promise, {
    loading: 'Sending reminder...',
    success: (result) => {
      const parts = ['Reminder sent'];
      if (result.sent) parts.push('email delivered');
      else if (result.failed) parts.push('email failed');
      else if (result.skipped) parts.push('no email on file');
      return parts.join(' · ');
    },
    error: 'Failed to send reminder',
  });
}}
```

## Files

| File | Change |
|---|---|
| `src/pages/admin/SurveyResponses.tsx` | Replace `resend.mutate(...)` callback-style with `toast.promise(resend.mutateAsync(...))` for immediate + final feedback. Apply same pattern to Cancel button. |

## Notes
- No backend, schema, or hook changes needed.
- `toast.promise` is the standard sonner pattern for async actions — gives instant visual confirmation that the click registered.
