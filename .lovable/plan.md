# Documents in student folders

Give case managers, org admins and admins a place to upload files inside a student's folder — IDs, receipts, resumes, court or medical paperwork — alongside the notes and certifications already there.

## What gets added

A new **Documents** tab in the student folder with:

- Drag-and-drop or "Choose files" upload, multiple files at once, with a progress bar
- A category on each file: ID & documents, receipt, resume, medical, court/legal, education/training, other
- An optional short description
- A list showing file name, category, size, who uploaded it, and the date
- Category filter chips, plus open/preview (images inline) and download
- Delete available to the person who uploaded the file, and to admins and org admins

Limits: 10 MB per file, up to 50 files per student. Accepted: PDF, Word, Excel, CSV, images (JPG, PNG, WEBP, HEIC, GIF) and plain text.

## Who can see what

Staff only. Case managers see documents for students assigned to them, org admins for students in their organizations, admins for everyone. Students never see this tab and cannot read the files — the existing request attachments stay exactly as they are today.

## Technical notes

- New private storage bucket `student-documents` (10 MB per-file limit), paths keyed as `<student_id>/<uuid>-<safe_name>`.
- New table `public.student_documents`: `student_id`, `category`, `description`, `file_name`, `file_path`, `file_size`, `mime_type`, `uploaded_by`, timestamps + `updated_at` trigger. GRANTs to `authenticated` and `service_role` only (no `anon`).
- RLS mirrors existing folder access using the current helpers: read/insert gated on `can_staff_manage_student(auth.uid(), student_id)`; delete on `uploaded_by = auth.uid()` or `has_role(auth.uid(),'admin')` or (`is_org_admin` and `user_in_org_admin_scope_v2`). Matching `storage.objects` policies on the bucket resolve the student from the first path segment.
- New `src/hooks/useStudentDocuments.ts` (list/upload/delete/signed URL) following the shape of `useStudentCertifications.ts`, and `src/components/students/StudentDocuments.tsx` reusing the upload/list patterns from `RequestAttachments.tsx`.
- `src/pages/StudentDetail.tsx` gains one `documents` tab; no other tab or flow changes.
