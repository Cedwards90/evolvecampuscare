# Student CRM view for user management

Turn the current user list into a real student record view: every student in one place with full information, inline editing of class and enrollment details, funding totals, and a stage funnel — using the data already in the platform.

## What changes for you

### 1. Student CRM table
A new "Students" view on the user management page showing, for each student:

- Name (preferred + legal), student ID, email, phone
- Organization and class (cohort)
- Assigned case manager
- Enrollment status (Active / Inactive, with reason)
- Program dates: cohort start, graduation, placement
- Age (from date of birth)
- Open requests count and last activity date
- Total money dispersed (sum of approved amounts across their requests)

The table scrolls horizontally on smaller screens, with a column picker so you choose which fields to show, plus search and existing filters (organization, class, case manager, status). Export the current view to CSV.

### 2. Inline editing of class and enrollment
From each row (and from a right-side detail panel):

- Change class/cohort
- Change organization
- Reassign case manager
- Set cohort start, graduation, and placement dates
- Activate / deactivate enrollment with a reason
- Edit contact and address details

Editing uses the existing edit-profile and assignment flows, so audit logging and permissions stay intact. Bulk actions: select multiple students to change class, organization, or case manager in one step.

### 3. Money dispersed
- Per-student total approved funding, and a breakdown by fund when opened
- A summary strip above the table: students shown, total dispersed, average per student, number of funded students
- Totals always reflect the current filters and search

### 4. Conversion funnel
A compact funnel card for the students currently in view: Invited → Signed up → Profile complete → Enrolled in class → Graduated → Placed. Each stage is clickable to filter the table to those students. Stages with no data say so rather than showing a zero that looks like a real number.

### 5. Access rules
- Admins: all students
- Org admins: only students in their organizations
- Case managers: their assigned students; they can view and update class/contact details but not deactivate accounts or change roles

Sensitive fields (date of birth, address, funding amounts) follow the existing role permissions.

## Technical notes

- New `src/hooks/useStudentCrm.ts`: joins `profiles`, `user_roles`, `cohorts`, `training_organizations`, `student_assignments`, and aggregated `support_requests` (approved amount, open count, last activity). Enrollment status derives from `deactivated_at` as today; no new columns are added.
- New components under `src/components/admin/crm/`: `StudentCrmTable.tsx`, `StudentCrmToolbar.tsx` (search, column picker, export), `StudentDetailPanel.tsx`, `CrmSummaryBar.tsx`, `EnrollmentFunnelCard.tsx`, `BulkStudentUpdateDialog.tsx`.
- `src/pages/admin/UserManagementPage.tsx` gains tabs: **Students (CRM)** | **All users** | **Invitations**. The existing all-users table, role changes, deletion, MFA, and org-admin dialogs stay exactly as they are.
- Writes reuse `useEditProfile`, `useAssignStudentCohort`, `useSetUserActive`, and the existing assignment hooks, so `profile_edit_audit` and `user_status_audit` keep recording changes.
- No schema migration required. No changes to student-facing screens.
- Money uses the existing currency formatting helper and counts only `approved_amount` on non-denied requests, matching the reports.
