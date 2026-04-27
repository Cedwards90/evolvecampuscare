## Goal
After clicking **Resend** on a pending survey invitation, open a small modal that clearly shows the outcome — delivered, skipped (no email on file), or failed — along with any error message returned by the backend.

## What changes

### 1. `src/pages/admin/SurveyResponses.tsx` — add a result dialog
- In `PendingRow`, add local state:
  - `resultOpen: boolean`
  - `result: { status: 'delivered' | 'skipped' | 'failed'; recipient?: string; error?: string } | null`
- Update the Resend `onClick`:
  - Keep the existing `toast.loading` → `toast.success/error` flow (for quick feedback).
  - After `resend.mutateAsync(...)` resolves, derive status from the `SendResult`:
    - `result.sent > 0` → `delivered`
    - `result.failed > 0` → `failed` (use `invitation.email_error` as fallback message if available)
    - `result.skipped > 0` → `skipped`
  - Set `result` and `resultOpen = true`.
  - On thrown error, set `result = { status: 'failed', error: err.message }` and open the modal.
- Render a `<Dialog open={resultOpen} onOpenChange={setResultOpen}>` with:
  - Icon + title per status:
    - Delivered → green CheckCircle2, "Reminder delivered"
    - Skipped → amber AlertCircle, "Reminder skipped"
    - Failed → red XCircle, "Reminder failed"
  - Body:
    - Recipient line: `To: {invitation.student_email}`
    - Survey type: `Survey: {typeLabel}`
    - For `skipped`: explain "No email address on file for this student."
    - For `failed`: show the error in a muted code-style block, fallback "The email service did not accept the message."
    - For `delivered`: "The reminder email was sent successfully."
  - Footer: single **Close** button.

### 2. No backend / hook changes
- `useResendInvitation` already returns `{ sent, failed, skipped }` and the optimistic cache patch keeps the row in sync. No edits needed there.

## Files
- `src/pages/admin/SurveyResponses.tsx`

## Notes
- Reuse existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog` and `Button` from `@/components/ui/button`.
- Icons from `lucide-react` (`CheckCircle2`, `AlertCircle`, `XCircle`).
- Modal is per-row (state lives inside `PendingRow`), so multiple rows don't conflict.
- Toasts remain for non-blocking feedback; the modal is the explicit confirmation requested.
