# Fix: Students can't upload documents with their requests

## Root cause

In `src/pages/SubmitRequest.tsx` (Step 3 "Add Supporting Documents", lines ~379–404), the attachment UI is a **non-functional placeholder**:

- No `<input type="file">` element exists.
- The "Browse Files" button has no `onClick` handler.
- The drag-and-drop zone has no `onDrop`/`onDragOver` handlers.
- `onSubmit` never uploads anything — it only calls `submitRequest.mutateAsync(...)`.

So any student going through the submit wizard sees an upload area, clicks "Browse Files", nothing happens, and the request is submitted with zero attachments. The fully-working `RequestAttachments` component (used in `RequestDetail`) is never mounted here.

The backend itself is fine: `useUploadAttachment` in `src/hooks/useRequestAttachments.ts` works, validates size/mime, writes to the `request-attachments` bucket, and inserts into `request_attachments` — it just needs a `requestId`, which doesn't exist until the request is created.

## Fix (frontend only — no schema or business-logic changes)

Make Step 3 collect files locally, validate them, then upload them after the request row is created in `onSubmit`.

### 1. `src/pages/SubmitRequest.tsx`

- Add local state: `const [pendingFiles, setPendingFiles] = useState<File[]>([])` and a hidden `<input ref>`.
- Replace the placeholder Step 3 block with a real picker:
  - Hidden `<input type="file" multiple accept={ALLOWED_MIME_TYPES.join(',')}>` whose `onChange` appends to `pendingFiles`.
  - Wire `onClick` on "Browse Files" to `inputRef.current?.click()`.
  - Wire `onDragOver` / `onDrop` on the dashed zone to accept dropped files.
  - Client-side validation using the existing constants from `useRequestAttachments`: `MAX_FILE_SIZE` (10 MB), `MAX_FILES_PER_REQUEST` (10), `ALLOWED_MIME_TYPES`. Reject with a toast on violation; don't silently drop.
  - Render the chosen files as a small list with name, size, and a remove (×) button.
- In `onSubmit`, after `submitRequest.mutateAsync(...)` returns the new request's `id`:
  - For each file in `pendingFiles`, call the upload logic against that id. Two options, pick whichever fits the existing patterns:
    - **Preferred**: extract the inner upload body of `useUploadAttachment` into a small `uploadAttachment(requestId, file)` helper exported from `useRequestAttachments.ts` so the wizard can call it imperatively per file. This avoids needing a dynamic-hook trick. The existing `useUploadAttachment` keeps working unchanged by delegating to that helper.
    - Or call the storage + insert sequence inline (duplicates a few lines — less clean).
  - Show per-file failures as toasts but **don't fail the whole submit** — the request is already created. Use a single summary toast: "Request submitted. 2 of 3 files uploaded — you can retry the rest from the request page."
- Keep the existing success navigation to the request detail page so students land where they can re-upload any failed file.

### 2. `src/hooks/useRequestAttachments.ts`

- Export a plain async `uploadAttachment(requestId: string, file: File): Promise<void>` that contains the current body of `useUploadAttachment`'s `mutationFn` (size/mime check, storage upload, table insert, rollback on insert failure).
- Refactor `useUploadAttachment` to call that helper — no behavior change for `RequestDetail`.

### 3. Out of scope

- No DB migration. The `request_attachments` table, RLS, and storage bucket already exist.
- No change to `RequestDetail` / `RequestAttachments.tsx` behavior.
- No change to QR standalone flow (it doesn't show an upload step today — flag separately if the user wants it added).
- No offline-draft upload sync changes.

## Verification

1. Sign in as a student, start a new request, reach Step 3, pick a PDF + a PNG, submit.
2. Land on the request detail page — both files appear in the Attachments card.
3. Verify rejections: a 15 MB file is blocked with a toast; an `.exe` is blocked; adding an 11th file is blocked.
4. Verify the existing `RequestDetail` upload still works (regression check on the refactored helper).
