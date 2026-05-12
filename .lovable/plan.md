# Student Folder Summary

Adds a one-click "Generate Folder Summary" action on every student profile/folder. It pulls everything the caller is authorized to see (profile, intake survey, support requests + updates, case/file notes, certifications, appointments, check-ins, post-graduation plan, uploaded attachments metadata) and produces a strictly-grounded AI summary organized into fixed sections, with on-screen preview, PDF download, audit logging, and live updates.

## Scope

- Reuses the existing grounded-AI pattern from `student-progress-summary` — no new AI provider, no new secrets.
- Reuses `jspdf` (already in use via `studentProgressExport.ts`) for PDF export.
- New backend artifacts: 1 edge function + 1 audit table.
- Frontend changes limited to: 1 new button/dialog component, mounted in `StudentDetail.tsx` next to the existing `GenerateStudentReportCard`. No other pages touched.

## What it covers (folder evidence)

Pulled server-side, only what the caller's RLS already permits:

- Profile basics (name, cohort, graduation date, org, assigned CM)
- Intake survey responses (`intake_responses`)
- Support requests + `request_updates` + attachment metadata (filenames only, no file contents)
- Case/file notes (`file_notes`)
- Certifications (`student_certifications` joined to `certification_catalog`)
- Appointments (past + upcoming, status)
- Student check-ins (mood, progress, wins, blockers)
- Post-graduation plan (if any)

If a section has no evidence, the AI is instructed (and JSON-schema constrained) to return `"No data available."` for that section — never invented content.

## Output sections (fixed)

1. Key updates (last 30 days)
2. Completed items
3. Missing documents / gaps
4. Risks & red flags
5. Areas of improvement
6. Achievements
7. Recommended next steps

Each section returns an array of short bullet strings + an evidence reference list (ids of the records that grounded each bullet) so the UI can show "based on N items".

## Permissions

Same model already enforced everywhere else:
- Admin: any student
- Case Manager: only assigned students (`student_assignments`)
- Org Admin: students in their org scope (`user_in_org_admin_scope_v2`)
- Students: **cannot** generate (button hidden, edge function rejects)

Reuses `can_staff_manage_student(actor, student)` SQL function for the auth check inside the edge function.

## Audit logging

New table `folder_summary_audit`:

| column | type |
|---|---|
| id | uuid pk |
| student_id | uuid |
| actor_id | uuid |
| action | text  (`generated` / `downloaded_pdf`) |
| section_counts | jsonb (per-section bullet counts) |
| evidence_counts | jsonb (notes/requests/checkins/etc.) |
| created_at | timestamptz |

RLS:
- INSERT: actor_id = auth.uid() AND `can_staff_manage_student(auth.uid(), student_id)`
- SELECT: admin, or staff who can manage that student
- No UPDATE / DELETE

Edge function inserts a `generated` row on every successful summary; the frontend posts a `downloaded_pdf` row when the user clicks Download PDF.

## Real-time syncing

Add `folder_summary_audit` to `REALTIME_TABLES` in `realtimeRouter.ts` so the StudentDetail view's "last generated" indicator refreshes live. The summary itself is regenerated on demand (not cached), so it always reflects current folder contents.

## "No fabrication" guardrails

- AI call uses tool/JSON-schema response (same as `student-progress-summary`) — model cannot return free-form prose outside the defined section arrays.
- System prompt: "Only use facts present in the supplied evidence JSON. If a section has no relevant evidence, return exactly `[\"No data available.\"]`. Do not infer, extrapolate, or invent names, dates, diagnoses, or outcomes."
- Each bullet must include `evidence_ids: string[]` referencing supplied evidence; bullets with empty evidence arrays are filtered out client-side before render/PDF.
- Empty folder → entire response is "No data available." per section, plus a banner in the UI.

## UI

New component `src/components/reports/FolderSummaryButton.tsx` — a card identical in style to `GenerateStudentReportCard`:
- Title: "Folder summary"
- Description: "AI-generated overview of this student's full folder, grounded only in stored records."
- Primary button: "Generate folder summary"
- Opens a dialog (`FolderSummaryDialog.tsx`) showing:
  - Loading skeleton while edge function runs
  - 7 collapsible sections with bullets and per-bullet evidence chips ("3 sources")
  - Footer: `Download PDF` (logs `downloaded_pdf`) + `Regenerate` + `Close`
  - Empty-state banner when all sections are "No data available."

Mounted in `StudentDetail.tsx` directly below the existing `GenerateStudentReportCard` (single line addition). Hidden when current user is the student themselves.

## PDF export

New helper `src/lib/folderSummaryPdf.ts` using `jspdf` + `jspdf-autotable` (already installed). Layout matches existing student progress PDF header/footer for visual consistency:
- Header: Evolve Foundation logo, student name, "Folder Summary", generated timestamp, generated-by name
- One section per heading with bulleted lines
- Footer: "AI-generated. Grounded in folder records as of {timestamp}. Verify before acting."
- Filename: `evolve-folder-summary_{studentSlug}_{yyyy-mm-dd}.pdf`

## Files

**New**
- `supabase/migrations/<ts>_folder_summary_audit.sql` — table + RLS
- `supabase/functions/generate-folder-summary/index.ts` — modelled on `student-progress-summary`
- `src/components/reports/FolderSummaryButton.tsx`
- `src/components/reports/FolderSummaryDialog.tsx`
- `src/hooks/useFolderSummary.ts` — invokes edge function, exposes `generate()` + `lastGeneratedAt`
- `src/lib/folderSummaryPdf.ts`

**Edited (minimal, additive only)**
- `src/pages/StudentDetail.tsx` — one extra `<FolderSummaryButton studentId={id} />` next to the existing report card
- `src/lib/realtimeRouter.ts` — add `folder_summary_audit` to `REALTIME_TABLES`

No other pages, no schema changes outside the new table, no changes to existing edge functions.

## Technical details

- Edge function CORS / sanitizeError / `auth.getUser()` follow the project security pattern (same as `student-progress-summary`).
- Model: `google/gemini-2.5-flash` (cheap, fast, tool-call capable) via Lovable AI Gateway — already used in `student-progress-summary`.
- Evidence payload trimmed: max 50 most-recent records per category; bullets capped at 6 per section to keep the PDF to 1–2 pages.
- Memory: add `mem://features/folder-summary-v1` after build.

## Out of scope (explicit, ask before adding)

- Caching/storing the generated summary text (regenerated each click as requested for real-time accuracy)
- Sharing summary via tokenized public link (PDF sharing already covered by existing `share-request-pdf` pattern; can be added later)
- Including raw file contents from the `student-certifications` storage bucket (only filenames are referenced)
