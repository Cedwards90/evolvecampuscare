## Goal

Strengthen assign/unassign student controls by adding searchable selection, validation feedback, permission checks, and surfacing controls where they're currently missing — while reusing existing assignment hooks (`useAssignStudent`, `useRemoveStudentAssignment`, `useBulkAssignStudents`) so all dependent data (CM dashboards, request lists, workload counts) updates automatically.

## What already works (do not change)

- `useStudentAssignments.ts` mutations already invalidate `student-assignments`, `unassigned-students`, `requests`, `case-managers`, `case-manager-stats` on success.
- RLS already restricts `student_assignments` writes to admins.
- `StudentAssignmentDialog` and `BulkStudentAssignmentDialog` already show CM workload bars and warnings.
- `StudentAssignmentsTable` (Admin Dashboard) already has assigned/unassigned tabs, bulk select, and remove confirmation.

## Changes

### 1. Searchable case manager selection (`StudentAssignmentDialog` + `BulkStudentAssignmentDialog`)
- Add a search input above the CM list filtering by name/email.
- Empty-state message when no CM matches.
- Disable selection of CMs already at 100% capacity (still shown, marked "At capacity").

### 2. Searchable student selection in unassigned tab (`StudentAssignmentsTable`)
- Add a search input above the unassigned students table (filter by name/email).
- Add the same search above the assigned tab so admins can quickly find an existing assignment to reassign/remove.

### 3. Permission guard
- Wrap `StudentAssignmentsTable` rendering with a role check via `useAuth()`. If `role !== 'admin'` show a "You do not have permission" message instead of mounting the data hooks. (Defense in depth — RLS is the real gate.)

### 4. Assign/Unassign card on Student Detail page (admin only)
- New small component `StudentAssignmentCard` shown in `StudentDetail.tsx` for admins.
- Shows current assigned CM (or "Unassigned") with Assign / Reassign / Unassign buttons that open the existing `StudentAssignmentDialog` and reuse `useRemoveStudentAssignment`.
- Hidden for case_manager and student roles.

### 5. Validation feedback
- In `StudentAssignmentDialog`, block submit (with inline error) when selected CM is at full capacity.
- In remove confirmation, surface count of pending requests that will become unassigned (currently shown only in the assign flow).

## Files

- Edit `src/components/admin/StudentAssignmentDialog.tsx` — add search + capacity guard.
- Edit `src/components/admin/BulkStudentAssignmentDialog.tsx` — add CM search.
- Edit `src/components/admin/StudentAssignmentsTable.tsx` — add student search on both tabs, role guard, show pending-request count in remove dialog.
- New `src/components/admin/StudentAssignmentCard.tsx` — assign/unassign panel for one student.
- Edit `src/pages/StudentDetail.tsx` — render `StudentAssignmentCard` for admins (single insertion point near profile header).

## Out of scope

- No DB migrations (RLS already correct).
- No changes to mutation logic or query invalidation (already complete).
- No changes to case manager / student-facing UI beyond the admin-only card on StudentDetail.
