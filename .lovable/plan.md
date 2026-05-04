## Goal
Let students edit a request they've already submitted, but only while it's still in the `submitted` status (before a case manager starts work). Once it's `in_progress`, `escalated`, `resolved`, or `cancelled`, editing is locked.

This matches the existing RLS policy ("Students can update their own pending requests") so no database/policy changes are needed.

## Scope (frontend only)

### 1. New component: `src/components/requests/EditRequestDialog.tsx`
A dialog (reusing shadcn `Dialog` + form patterns from `SubmitRequest.tsx`) that lets a student edit:
- Title
- Description
- Category
- Priority (capped at non-emergency, or kept editable — match SubmitRequest behavior)
- Is emergency flag
- Requested amount (only when category is `financial`)

On save:
- Update the row in `support_requests` via Supabase client
- Invalidate the `useRequest` and `useRequests` React Query caches
- Insert a `request_updates` row with a note like "Student edited the request" (no status change) so the activity timeline reflects the edit
- Show a success toast

### 2. Wire into `src/pages/RequestDetail.tsx`
- Add an "Edit Request" button in the header (or next to the Request Details card title), visible only when:
  - `role === 'student'`
  - `request.student_id === user.id`
  - `request.status === 'submitted'`
- Button opens `EditRequestDialog`.

### 3. Wire into `src/pages/TrackRequests.tsx`
- In the request side sheet, show an "Edit" button under the same conditions (status === 'submitted').

### 4. UX details
- If the student tries to edit and the status changed in the meantime, surface a clear error toast ("This request can no longer be edited") and close the dialog — the RLS policy will reject the update.
- Form uses the same validation as `SubmitRequest` (required title/description, etc.).
- Disable the save button while the mutation is in flight.

## Files to create
- `src/components/requests/EditRequestDialog.tsx`

## Files to edit
- `src/pages/RequestDetail.tsx` — add Edit button + dialog mount
- `src/pages/TrackRequests.tsx` — add Edit button in the sheet

## Out of scope
- No DB / RLS / migration changes (existing policy already covers this).
- No changes to staff (case manager / admin) editing flows.
- No edits to attachments in this pass (can be added later if desired).
