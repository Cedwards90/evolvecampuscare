
# Add Organizational Admin Role

A new staff-tier role (`org_admin`) that gets admin-like powers, but only over data tied to the organizations they govern. Full Admins remain unchanged and continue to see everything.

## What an Org Admin can do
- View students, requests, surveys, check-ins, and case files **belonging to their organization(s) only**
- View workload / growth / resolution-time analytics scoped to their org(s)
- Invite Students and Case Managers — invitation is locked to one of their org(s)
- Assign / reassign Case Managers (only those in the same org) to students in that org
- Send messages to staff and students in their org(s)
- Required to enroll TOTP MFA (AAL2), same as Admin/Case Manager

## What an Org Admin cannot do
- See or touch any data outside their assigned organization(s)
- Edit site_settings, notification toggles, training organizations CRUD
- Delete users (Danger Zone)
- Change user roles or grant admin/org_admin to others
- Invite full Admins
- Bypass any of the above through the UI (routes hidden) or the API (RLS enforced)

## Data model

New enum value + dedicated mapping table (multi-org):

```text
app_role: 'admin' | 'case_manager' | 'student' | 'org_admin'  ← NEW

org_admins
  id              uuid pk
  user_id         uuid  -- the org admin
  organization_id uuid  -- training_organizations.id
  created_at, created_by
  UNIQUE(user_id, organization_id)
```

Helper functions (SECURITY DEFINER, avoid RLS recursion):
- `is_org_admin(_user_id)` → boolean
- `is_org_admin_of(_user_id, _org_id)` → boolean
- `org_admin_orgs(_user_id)` → setof uuid (used inside RLS `IN (...)` subqueries)

## RLS changes (org-scoped reads/writes)

Add an `OR` clause to the existing case-manager/admin policies on these tables, gated by `is_org_admin_of(auth.uid(), <row's org>)`:

- `profiles` — view profiles where `profiles.organization_id` is in their orgs
- `support_requests` — view + update (status, assignment) where the student's org is in their orgs
- `student_assignments` — view + insert + update where student's org matches; case_manager assigned must also be in that org
- `student_files`, `file_notes`, `intake_responses`, `post_graduation_plans`, `student_checkins`, `survey_invitations`, `appointments`, `request_updates`, `request_attachments`, `staff_messages` — view via the student's org membership
- `organization_memberships` — view rows for their org(s)
- `user_invitations` — insert only when `organization_id` ∈ their orgs and `invited_role` ∈ ('student','case_manager'); view their own invites
- `user_roles` — read-only for users in their org(s); **no insert/update/delete**
- Explicitly **not extended**: `site_settings`, `training_organizations` (write), `bulk_invite_jobs` admin tools, user-deletion edge function

## Frontend changes

- `useUserRole` / role hook: surface `isOrgAdmin` and `orgAdminOrgIds[]`
- New layout role guard: `org_admin` is treated as "staff" for MFA enforcement and sidebar
- Sidebar (org_admin): Dashboard, Requests, Students, Assignments, Surveys, Analytics, Invitations, Messages — hide Site Settings, Training Orgs, Danger Zone, Admin Notifications, Bulk Tools
- Reuse existing Admin pages but auto-apply an `organization_id IN orgAdminOrgIds` filter at the hook layer (`useGlobalFilters`, `useStudents`, `useRequests`, `useWorkloadAnalytics`, `useSurveyResponses`, `useAssignments`)
- Invitation form: lock organization picker to their org(s); hide Admin/Org-Admin role options
- Assignment UI: case-manager dropdown filtered to CMs in the same org as the student

## Admin UX for managing Org Admins

In `/admin/users` (Admin only):
- New "Org Admin" role chip on user rows
- "Assign as Org Admin" action → opens dialog to pick one or more organizations → writes to `org_admins`
- Manage / revoke org assignments from the same dialog

## Security notes
- All scoping enforced in RLS — the UI filters are convenience only
- MFA: extend the existing staff MFA gate to include `org_admin` (must enroll + use AAL2)
- New helper functions are `SECURITY DEFINER` with explicit `search_path=public` to prevent recursion and search-path attacks
- Org Admins cannot escalate: no policies grant them write access to `user_roles` or `org_admins`

## Out of scope
- Admins-of-admins, cross-org reporting for org admins
- Org-admin-managed billing or org settings (training_organizations CRUD stays Admin-only)
- Bulk invite jobs UI for org admins (can be added later)

## Files likely touched
- New migration: enum value, `org_admins` table + RLS, helper functions, extended policies on ~12 tables
- `src/hooks/useUserRole.ts`, `useGlobalFilters.ts`, students/requests/analytics/assignments/surveys hooks
- `src/components/SidebarLayout.tsx`, MFA gate component
- `src/pages/admin/Users.tsx` (+ new `OrgAdminAssignmentDialog`)
- Invitation form and assignment dropdowns
