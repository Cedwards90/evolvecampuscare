## Suspend Organization Access

Adds the ability for Admins and Org Admins to suspend an organization. When suspended: the org's data is hidden from staff (dashboards, reports, lists) and members of that org see an in-app banner that disables write actions. Data is preserved; reinstating restores everything.

### Database

New migration:
- Add `suspended_at timestamptz`, `suspended_by uuid`, `suspension_reason text` to `public.training_organizations` (keep existing `is_active` untouched — it's used elsewhere for archival).
- Helper SQL function `public.is_org_suspended(_org_id uuid)` (SECURITY DEFINER, stable).
- Helper `public.is_user_org_suspended(_user_id uuid)` — true if the user's `profiles.organization_id` is suspended OR any active membership is in a suspended org.
- Audit table `org_suspension_audit` (id, organization_id, actor_id, action `'suspended' | 'reinstated'`, reason, created_at) with GRANTs + RLS (admins + org admins of that org can view/insert).
- Update RLS hide-rules: extend `can_staff_manage_student`, `user_in_org_admin_scope_v2`, and the org-scoped SELECT policies on `profiles`, `support_requests`, `appointments`, `file_notes`, `intake_responses`, `post_graduation_plans`, `student_certifications`, `organization_memberships` to additionally require `NOT is_user_org_suspended(student_id/user_id)`. Admin-role policies remain unrestricted so Admins can still see and reinstate.

### Backend permissions

- Only Admin or Org Admin of that specific org can update suspension columns (enforced via existing `Admins manage all` + a new policy `Org admins can suspend own org`).

### Frontend

**Suspension controls (Admins + Org Admins of that org):**
- `src/pages/admin/OrganizationDetail.tsx`: Add a "Suspend access" / "Reinstate access" button in the header card, with a confirm dialog that captures a reason. Show a red "Suspended" badge next to the org name and a banner summarizing who/when/why with a link to audit history (new tab).
- `src/pages/admin/TrainingOrganizations.tsx`: Show suspended state badge in the list and quick suspend/reinstate action.
- New hook `src/hooks/useOrgSuspension.ts` (`useSuspendOrg`, `useReinstateOrg`, `useOrgSuspensionAudit`) — invalidates org, member, student, request, analytics queries.

**Member-facing banner:**
- New hook `src/hooks/useMyOrgSuspension.ts` — returns `{ suspended, orgName, reason, suspendedAt }` for the current user.
- New component `src/components/OrgSuspendedBanner.tsx` — persistent banner shown inside `SidebarLayout` when suspended.
- New context `src/contexts/OrgSuspensionContext.tsx` providing a `isSuspended` flag.
- Guard write actions: small helper `useWriteGuard()` returning a disabled state + tooltip ("Your organization's access is suspended"). Apply to the primary submit buttons in: `SubmitRequest.tsx`, `ComposeMessage.tsx`, `ScheduleMeetingDialog.tsx`, `StudentCheckIn.tsx`, `PostGraduationPlan.tsx`, `CertificationDialog.tsx`, `IntakeSurvey.tsx`. (Server-side RLS is the real enforcement; this is UX.)
- Org Admins of a suspended org continue to see admin pages but their org's member data is hidden by RLS — they still see the suspend/reinstate controls because that lives on `training_organizations`, which remains visible.

### Realtime

- Add `training_organizations` and `org_suspension_audit` to `REALTIME_TABLES` in `src/lib/realtimeRouter.ts` so banners and badges update instantly when toggled.

### Out of scope

- Login blocking (members can still sign in; only writes are gated + data hidden). Confirmed per your "Banner inside app" choice.
- Deleting or archiving any data.
- Bulk suspension across multiple orgs.

### Files

**Created:** migration, `src/hooks/useOrgSuspension.ts`, `src/hooks/useMyOrgSuspension.ts`, `src/contexts/OrgSuspensionContext.tsx`, `src/components/OrgSuspendedBanner.tsx`, `src/components/admin/SuspendOrgDialog.tsx`.

**Edited:** `src/pages/admin/OrganizationDetail.tsx`, `src/pages/admin/TrainingOrganizations.tsx`, `src/components/layouts/SidebarLayout.tsx` (mount banner + provider), `src/lib/realtimeRouter.ts`, plus minimal `disabled` wiring on the listed write surfaces. New memory entry `mem://features/org-suspension-v1`.
