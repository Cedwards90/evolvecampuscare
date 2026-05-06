## Goal

Give Organizational Admins (org_admin) the same caseload-management capabilities Admins have today — but scoped to the students and case managers in the org(s) they administer.

## What's already in place

- DB-level RLS on `student_assignments` already allows org_admin to SELECT/INSERT/UPDATE/DELETE rows where both the student and the case manager are inside one of their orgs (`is_org_admin_of` + `user_in_org_admin_scope`).
- Sidebar + routes already grant org_admin access to **Admin Dashboard**, **Case Managers**, **Manage Requests**, **Student Folders**, **QR Codes**, **Surveys**, **Reports**.
- `profiles`, `user_roles`, `support_requests`, `request_updates`, `appointments`, `staff_messages`, etc. all have org-scoped RLS that already work for org_admin.

The plumbing exists; the **app code still treats these screens as admin-only in places** and never exposes the assignment UI to org_admin.

## The actual gaps (frontend only)

1. **`useReassignStudent` hard-blocks non-admin actors**
   `if (role !== 'admin') throw new Error('Only administrators can reassign students.')` — this rejects org_admin even though RLS would allow it. Allow `admin` OR `org_admin`.

2. **`AdminDashboard.tsx` (`/admin-monitoring-reassigning-requests`)**
   - Hides nothing for org_admin, but the **assignment surfaces inside it** (the `StudentAssignmentsTable`, `AssignCaseManagerDialog`, `BulkStudentAssignmentDialog`) need to render for org_admin. Verify their internal role gates (none found, so they should already work) — explicitly confirm and remove any that exist.
   - Title/description copy stays the same; data is naturally scoped by RLS.

3. **`CaseManagersPage.tsx`** (already routed for org_admin) — verify the "Reassign student" action calls through `useReassignStudent` (which we just unblocked) and renders the workload bars from `useCaseManagers()`. RLS on `profiles` + `user_roles` already returns only in-scope CMs/students, so workload counts will reflect their org.

4. **`StudentAssignmentsTable` + `BulkStudentAssignmentDialog` + `StudentAssignmentDialog`**
   Mount on the Admin Dashboard for org_admin too (no role check needed in the components themselves; just make sure the parent page renders them). Confirm `useUnassignedStudents` returns data when called by an org_admin (it queries `user_roles` then `student_assignments` — both have org_admin SELECT policies).

5. **`ReassignStudentDialog`** — currently triggered from CaseManagersPage. Remove any "admin-only" copy/guard so the button appears for org_admin too.

6. **Defense-in-depth in the reassign mutation**
   Since RLS now does the real enforcement, the JS-level role check becomes a UX guard. Replace the hard throw with a check that allows `['admin','org_admin']` and let RLS return a clear error if the target student/CM is outside the org_admin's scope.

## Out of scope

- No DB migrations (RLS already correct).
- No new pages or routes — we are unlocking existing screens, not building new ones.
- No changes to global Admin's experience.
- No changes to the NDA flow, MFA flow, or notification routing.

## Validation

After implementation, sign in as an org_admin and confirm:
- Admin Dashboard shows only requests for students in their org(s).
- Bulk-assign + single-assign dialogs list only in-scope unassigned students and only in-scope case managers, with workload bars.
- Reassigning a student to another in-scope CM succeeds and updates open requests; reassigning to an out-of-scope CM fails with a clear "not permitted" toast (RLS-driven).
- Assignment realtime updates on the CM's dashboard still fire (existing `useRealtimeStudentAssignments` is unaffected).

## Technical detail

Files expected to change (frontend only):
- `src/hooks/useReassignStudent.ts` — relax role gate to `['admin','org_admin']`.
- `src/pages/AdminDashboard.tsx` — ensure assignment management section renders for org_admin (it likely already does; remove any role-conditional wrappers if found during implementation).
- `src/pages/admin/CaseManagersPage.tsx` — ensure reassign action is enabled for org_admin.
- Possibly tiny copy tweaks in `ReassignStudentDialog.tsx` / `StudentAssignmentsTable.tsx` if they reference "admin only".

No edge function, migration, or schema changes.
