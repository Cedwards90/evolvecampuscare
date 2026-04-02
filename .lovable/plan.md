

## Plan: Student Folders View for Admin & Case Manager

### What Already Exists
- **`/students/:id`** (StudentDetail page) already shows a comprehensive student profile with tabs for Requests, Appointments, Activity, and a **Student File** tab (intake survey + progress notes). This is the "folder" — it just needs to be **discoverable** from both portals.
- The route is already protected for `case_manager` and `admin` roles.

### What's Missing
1. **No "Student Folders" listing page** — admins and case managers have no dedicated page to browse all student folders.
2. **Request details are not surfaced in the Student File tab** — when a student submits a request, it appears in the Requests tab but not in the Student File/folder as a chronological entry.

### Changes

#### 1. Create Student Folders Listing Page
**File:** `src/pages/StudentFolders.tsx` (new)

A searchable/filterable list of all students (for admins) or assigned students (for case managers). Each row shows:
- Student name, email, intake status (completed or pending)
- Number of requests, last activity date
- Link to `/students/:id` (the existing detail/folder page)

Uses existing queries: `profiles` + `user_roles` (filter to students) + `student_files` (intake status) + aggregate counts from `support_requests`.

#### 2. Add Route and Sidebar Navigation
**File:** `src/App.tsx` — Add `/student-folders` route, accessible to `case_manager` and `admin`.

**File:** `src/components/layouts/SidebarLayout.tsx` — Add "Student Folders" nav item (with a FolderOpen icon) visible to case managers and admins.

#### 3. Enhance Student File Tab with Request History
**File:** `src/pages/StudentDetail.tsx` — In the `StudentFileTab` component, add a "Request History" section below the Intake Summary and above Progress Notes. This renders each request as a compact card showing title, category, priority, status, date, and description snippet — giving a complete longitudinal view inside the folder.

#### 4. Create Hook for Student Folders Listing
**File:** `src/hooks/useStudentFolders.ts` (new)

Query that joins `profiles`, `user_roles`, `student_files`, and aggregates from `support_requests` to return a list of students with their folder metadata. For case managers, filter by `student_assignments`.

### Summary

| File | Action |
|------|--------|
| `src/pages/StudentFolders.tsx` | Create — searchable student folders listing |
| `src/hooks/useStudentFolders.ts` | Create — data hook for folders list |
| `src/pages/StudentDetail.tsx` | Edit — add request history to Student File tab |
| `src/App.tsx` | Edit — add `/student-folders` route |
| `src/components/layouts/SidebarLayout.tsx` | Edit — add nav link for Student Folders |

