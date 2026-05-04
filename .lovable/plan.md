## Goal
Add a proper "Case Notes" feature for each student in their folder (`/students/:id`) — staff-only, with type, optional title, edit/delete by author.

## Changes

### 1. Database migration
- Extend `file_notes` table:
  - `title text` (nullable)
  - `updated_at timestamptz default now()` (with trigger using existing `update_updated_at_column`)
- **Restrict student visibility**: drop `Students can view own file notes` policy so notes become staff-only (Admin + assigned Case Manager).
- Add policies:
  - Authors (case manager) can `UPDATE` and `DELETE` their own notes on assigned students.
  - Admins already have ALL via existing policy.
- Allow `note_type` values: `general`, `case_note`, `meeting`, `follow_up`, `intake_summary` (no enum change — column is text).

### 2. New hook updates (`src/hooks/useFileNotes.ts`)
- Add `updateNote({ id, content, title, noteType })` and `deleteNote(id)` mutations.
- Extend `addNote` to accept `title`.

### 3. New tab in `src/pages/StudentDetail.tsx`
- Add a `TabsTrigger value="case-notes"` (icon: `NotebookPen`) between File and Check-Ins.
- New `<TabsContent value="case-notes">` rendering a new component `StudentCaseNotesTab`.
- Component features:
  - Add-note form: type selector (General / Case Note / Meeting / Follow-up), optional title, longer textarea (min-h-[140px]), submit button.
  - Timeline list grouped by date with: title (if set), type badge, author name, timestamp, content (preserving line breaks via `whitespace-pre-wrap`).
  - Inline Edit / Delete buttons on notes authored by the current user (admins can edit/delete any).
  - Empty state with `EmptyState` component.
- Keep existing inline "Progress Notes" card on the File tab as-is for now (it will simply render the same data, staff-only); no duplication of write UI is required, but the simplest path is to remove the Progress Notes card from the File tab to avoid two entry points. **Plan: remove Progress Notes card from File tab** since Case Notes supersedes it.

### 4. Visibility note
Students currently can't reach `/students/:id` (route is staff-only), so the only behavior change for students is they will no longer see their own file_notes in any future student-facing surface. No current student UI surfaces these.

## Out of scope
- Attachments on notes.
- Mentions / tagging.
- Notifications when a note is added.
- Filtering/search within notes (can add later if list grows).

## Files touched
- `supabase/migrations/<new>.sql` (new)
- `src/hooks/useFileNotes.ts`
- `src/pages/StudentDetail.tsx` (add tab + component, remove Progress Notes card from File tab)
