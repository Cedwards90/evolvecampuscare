

Looking at this — currently the RLS policy "Participants can upload attachments" allows uploads for any request where the user is the student/case manager/admin, regardless of status. So technically uploads should already work on resolved requests.

Let me check the frontend — `RequestAttachments.tsx` doesn't seem to have any status gating, and `RequestDetail.tsx` renders it unconditionally based on my last edit.

Wait — the issue might be the storage bucket policies. Let me think... the recent migration added storage.objects policies for `request-attachments`. Need to confirm those don't gate by status either.

Actually re-reading the RLS: it joins to `support_requests` and only checks participation, not status. So both DB and storage should allow it. The user's complaint suggests something IS blocking it though.

Most likely culprit: students. The `support_requests` table has an UPDATE policy "Students can update their own pending requests" gated to `status = 'submitted'`, but uploading attachments doesn't update support_requests — it inserts into request_attachments. So that shouldn't block it.

Possibility: the RequestAttachments card might be hidden in the UI when status is resolved, OR there's a check I'm missing. Let me plan to verify and fix.

## Plan: Allow Attachments on Resolved Requests

### Investigation
- Check `RequestDetail.tsx` for any conditional that hides the attachments card when `status === 'resolved'`
- Check `RequestAttachments.tsx` for any disabled state based on request status
- Verify RLS policies on `request_attachments` and `storage.objects` for `request-attachments` bucket don't gate by status (current policies look status-agnostic)

### Likely fix
- Remove any status-based gating in the UI so the upload dropzone stays interactive on resolved/cancelled requests
- If RLS is found to gate by status, drop and recreate the policy without the status check
- Ensure the "Attachments" card always renders on `RequestDetail` regardless of status

### Files
| File | Change |
|---|---|
| `src/pages/RequestDetail.tsx` | Ensure Attachments card always visible |
| `src/components/requests/RequestAttachments.tsx` | Remove any status-based disable |
| Migration (only if needed) | Loosen RLS to ignore status |

### Notes
- No new tables, secrets, or buckets
- Will verify exact gate location during implementation before changing anything

