

Two requests:
1. File uploads (receipts/invoices) on support requests for all users
2. Mobile responsiveness improvements

For #1: `request-attachments` bucket already exists (private). `request_attachments` table exists with RLS allowing students to upload to their own requests and all participants to view. But the current INSERT policy only lets the student owner upload — case managers/admins can't. User said "all users" — should extend to staff too.

Let me check existing usage briefly.

Plan:

## Plan: File Attachments + Mobile Responsiveness

### Part 1: Document & Image Uploads on Requests

**Backend (already mostly in place):**
- `request-attachments` storage bucket exists (private)
- `request_attachments` table exists with view policy for all participants
- **Update RLS**: Extend INSERT policy so assigned case managers and admins can also upload (currently only the student owner can)
- **Add storage policies** on `storage.objects` for the `request-attachments` bucket: authenticated users can read/upload files for requests they participate in; path convention `{request_id}/{filename}`

**Frontend components:**
- New `src/components/requests/RequestAttachments.tsx` — list existing attachments (with thumbnails for images, icons for docs), upload new files via drag-and-drop or button, delete own uploads
- New `src/hooks/useRequestAttachments.ts` — fetch list, upload (to storage + insert row), get signed URLs for previews/downloads, delete
- Validation: max 10 MB per file, allowed types (images: jpg/png/webp/heic; docs: pdf/docx/xlsx/csv/txt), max 10 files per request
- Integrate into `src/pages/RequestDetail.tsx` — new "Attachments" card in the left column above the Reply card
- Optional: also expose upload during initial `SubmitRequest` flow as a final step (defer if scope creeps; include since user said "to support request")

### Part 2: Mobile Responsiveness Pass

Audit + fix the highest-traffic pages so layouts adapt to ≤640px:

- **`SidebarLayout`**: ensure mobile sidebar (Sheet) works on every page; add hamburger to top bar
- **`RequestDetail`**: stack the 3-col grid earlier; make header wrap; prevent horizontal scroll
- **`StudentFolders`, `ManageRequests`, `UserManagement`, `StudentAssignmentsTable`**: tables already have horizontal scroll per memory — verify, hide non-essential columns under `sm:`, add card-style fallback where missing
- **`Dashboard`, `AdminDashboard`, `AnalyticsDashboard`**: stat card grids → 1 col on mobile, 2 on `sm`, 4 on `lg`
- **`SurveyResponses`**: collapse tab content into stacked cards on mobile; ensure preview dialog scrolls
- **`Messages`**: list ↔ thread split should switch to single-pane with back button on mobile
- **Forms** (`SubmitRequest`, `CompleteProfile`, `IntakeSurvey`, dialogs): full-width inputs, sticky footer buttons, dialogs use `max-h-[90vh] overflow-y-auto`
- **Typography**: tighten heading sizes on `<sm` breakpoints
- **Touch targets**: ensure buttons ≥44px tall

### Files

| File | Action |
|---|---|
| Migration | Extend `request_attachments` INSERT policy + add storage.objects policies for `request-attachments` |
| `src/hooks/useRequestAttachments.ts` | Create |
| `src/components/requests/RequestAttachments.tsx` | Create |
| `src/pages/RequestDetail.tsx` | Add Attachments card |
| `src/pages/SubmitRequest.tsx` | Optional attachments step at end |
| Multiple page files (Dashboard, layouts, tables, forms) | Responsive class fixes |

### Notes
- Files stored at `{request_id}/{uuid}-{originalname}` in private bucket; previews via short-lived signed URLs
- Image previews inline (lightbox on click), other files show icon + filename + size + download button
- No new secrets needed
- Both parts can ship together in default mode after approval

