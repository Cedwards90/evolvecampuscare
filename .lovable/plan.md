## Fix "case notes not visible" and prevent recurrence

Jade's notes exist in the database; this is a UI/visibility problem. The fix has two goals: (a) prove to any staff member that a note landed, and (b) make notes discoverable outside a single student's folder.

### 1. Post-save confirmation + verification
- `CaseNotesSection` save handler: show a success toast that includes the student's name and the note's contact date, plus a link "View note".
- After a successful insert, re-fetch and scroll to the new row so the author immediately sees it in the list.
- Require a non-empty title OR default it to `{note_type} - {contact_date}` when blank so nothing renders as an empty row.

### 2. Realtime + cross-tab freshness
- Subscribe `file_notes` to the `supabase_realtime` publication.
- Add a channel in `useFileNotes` filtered by `student_id` that invalidates `['file-notes', studentId]` on INSERT/UPDATE/DELETE, so a second open tab or a peer viewer sees new notes without refresh.

### 3. Global "Recent Case Notes" activity feed
- New page `/admin/case-notes` (admins + org admins, plus case managers scoped to their own students) listing the last 30 days of notes across all accessible students: date, student, author, type, title, snippet, and a link to the student's folder.
- Add a compact "Recent notes" card to the admin dashboard and to each case manager's dashboard showing the last 5 notes they authored.

### 4. Close the org-suspension + reassignment blind spots
- Change `cm_can_access_student` policy path for `file_notes` SELECT so authors can always read notes they wrote, even after reassignment or org suspension. New policy: `author_id = auth.uid()`.
- Add a policy so admins and org admins in the student's org always see notes regardless of suspension (they already do via existing policies — verify and leave as is).
- No change to INSERT/UPDATE/DELETE policies.

### 5. Surface notes on the admin submissions view
- Add a "Case Notes" tab to `AdminStudentSubmissions` (`/admin/students/:id/submissions`) reusing `CaseNotesSection` in read-only mode, so admins investigating a student never miss them.

### Files touched
- `src/hooks/useFileNotes.ts` (realtime subscription, toast payload)
- `src/components/casemanager/CaseNotesSection.tsx` or equivalent (title fallback, scroll-to-new)
- `src/pages/admin/CaseNotesActivity.tsx` (new)
- `src/App.tsx` + `src/components/layouts/SidebarLayout.tsx` (route + nav)
- `src/pages/Dashboard.tsx` (recent-notes card)
- `src/pages/admin/AdminStudentSubmissions.tsx` (new tab)
- One migration: add `file_notes` to realtime publication + SELECT policy `Authors always see their own notes`.

### Verification
- Add a note as Jade → toast appears, row scrolls into view.
- Open the same folder as admin in a second browser → new note appears without refresh.
- Visit `/admin/case-notes` → the June 29–30 notes appear.
- Suspend a test org → the note author still sees their own notes.
