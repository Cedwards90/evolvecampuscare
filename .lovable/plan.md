
## Goal

When a platform admin suspends an organization, no one except platform admins should be able to see or touch that org's student data — not case managers, not org admins, not the students themselves' staff-facing surfaces. Also add a single page where platform admins can see every org's access status at a glance.

## Current state

- Org admins are already blocked: `user_in_org_admin_scope_v2` and most write policies (`certification_catalog`, `funding_goals`, `qr_codes`, `training_organizations`) explicitly require `NOT is_org_suspended(...)`.
- `can_staff_manage_student` blocks case managers + org admins when the student's org is suspended, which protects: `participant_outcomes`, `participant_demographics`, `impact_survey_assignments/responses`, `folder_summary_audit`.
- **Gap:** case-manager SELECT/UPDATE/INSERT policies on the core student tables do NOT check suspension. A case manager assigned to a student in a suspended org can still read/write:
  `profiles`, `support_requests`, `appointments`, `file_notes`, `intake_responses`, `post_graduation_plans`, `student_checkins`, `student_files`, `student_assignments`, `survey_invitations`, `request_attachments`, `ai_insights` (request-scoped).
- There is no single place to scan org access status; it's only visible by clicking each org.

## Changes

### 1. Database migration — close the case-manager gap

Add `AND NOT public.is_user_org_suspended(student_id)` (or the request's student) to every case-manager policy that touches student data, for SELECT, INSERT, and UPDATE:

- `profiles` — rewrite "Case managers and admins can view all profiles" into two policies: admins keep full access; case managers see profiles only when `NOT is_user_org_suspended(user_id)`.
- `support_requests` — case manager SELECT/UPDATE gated on `NOT is_user_org_suspended(student_id)`.
- `appointments` — case manager SELECT/INSERT/UPDATE gated likewise.
- `file_notes`, `intake_responses`, `post_graduation_plans`, `student_checkins`, `student_files`, `student_assignments`, `survey_invitations` — same gate on case-manager policies.
- `request_attachments` — extend the shared SELECT/INSERT policy: case manager branch requires the request's student org not suspended.
- `ai_insights` — case manager SELECT/UPDATE gated via the linked request's student.

Platform admin policies (`has_role(_, 'admin')`) are left untouched, so platform admins retain full visibility and control — they're the only role that can still see suspended-org data.

Students themselves keep read access to their own rows (so they aren't locked out of their own profile), but staff-facing views won't surface their data while suspended.

### 2. Central Access Status page

New admin route `/admin/access-status` (linked from the admin sidebar under Organizations) showing one row per training organization:

- Org name, member count, status pill (Active / Suspended), suspended-at date, suspended-by, reason snippet.
- Filter chips: All / Active / Suspended. Search by name.
- Row click → existing `OrganizationDetail` page.
- Bulk-friendly read-only view; suspend/reinstate still happens on the detail page (keeps the confirm-dialog flow intact).

The existing `TrainingOrganizations` list keeps its current shape; the new page is the dedicated access-status dashboard.

## Technical notes

- All policy changes go through one migration. For each affected policy: `DROP POLICY ... ; CREATE POLICY ...` with the added `NOT is_user_org_suspended(...)` clause. `is_user_org_suspended` is already `STABLE SECURITY DEFINER` so it's safe inside RLS.
- No app code needs to change for the visibility fix — RLS does the work and existing queries will just return empty for suspended orgs. UI already shows the `OrgSuspendedBanner` for affected members.
- New page: small component reusing `useQuery` over `training_organizations` joined with member counts and `org_suspension_audit` (latest row per org). Add a `<SidebarLink>` entry guarded by `role === 'admin'`.
- No changes to platform-admin policies, edge functions, or storage rules.
