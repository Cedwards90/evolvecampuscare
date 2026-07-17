## Goal
Allow Admins and Case Managers (and Org Admins, for consistency with existing edit permissions) to delete support requests when needed, with a safe confirmation flow and audit-friendly behavior.

## Backend (migration)
Add DELETE RLS policies to `support_requests` (currently there are none, so nobody can delete):

- **Admins** — can delete any request.
- **Case Managers** — can delete requests assigned to them (`assigned_case_manager_id = auth.uid()` and student accessible via `cm_can_access_student`).
- **Org Admins** — can delete requests for students in their org scope (mirrors existing update policy).

Related child rows (`request_updates`, `request_attachments`, `request_share_links`, `resource_recommendations`, notifications) — verify existing FKs. If any lack `ON DELETE CASCADE`, add cascade so a deletion cleans up cleanly. Storage objects in `request-attachments` bucket will be removed client-side before the row delete (best-effort) so orphan files aren't left behind.

## Frontend

1. **New hook** `useDeleteRequest` in `src/hooks/useRequest.ts`:
   - Fetches attachment storage paths, removes files from `request-attachments` bucket (best-effort).
   - Deletes the `support_requests` row.
   - Invalidates requests / student-detail queries and toasts on success.

2. **Delete action UI** — staff only (admin, case_manager, org_admin):
   - `src/pages/RequestDetail.tsx`: add a "Delete request" button in the staff actions area, styled destructive, with an `AlertDialog` that requires typing the word `DELETE` to confirm (matches existing Danger Zone pattern in the project). On success, navigate back to the requests list.
   - `src/components/requests/RequestQuickActions.tsx`: add a small trash icon (staff-only) opening the same confirmation dialog, so it's available inline from the Manage Requests table.

3. **Role gating**: use `useAuth` + `user_roles` (already loaded via existing hooks) to show the button only to admin / case_manager / org_admin. Students never see delete.

## Out of scope
- No changes to request creation, editing, approval flow, or notifications.
- No soft-delete / trash bin — user asked for delete; RLS + confirm dialog is the safety net.

## Technical notes
- Confirmation dialog reuses shadcn `AlertDialog` and the "type DELETE to confirm" pattern already used elsewhere.
- Storage cleanup uses `supabase.storage.from('request-attachments').remove([...paths])` and swallows errors so a storage hiccup doesn't block the row delete.
- All queries invalidated: `['requests']`, `['request', id]`, `['student-detail', studentId]`, `['notifications']`.