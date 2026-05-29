## Goal
When a platform admin suspends an organization, the org admin loses **all** write ability on that org — including the ability to reinstate it themselves.

## Current gap
- The `Org admins can suspend own org` UPDATE policy on `training_organizations` allows org admins to flip `suspended_at` back to NULL — so they can self-reinstate.
- The `Org admins manage own org qr codes`, `Org admins manage org catalog` (certification_catalog), `Org admins manage org goals` (funding_goals), and `Org admins insert own org suspension audit` policies use `is_org_admin_of(...)` directly without checking suspension, so an org admin could still mutate those rows while suspended.
- Helper-based policies (everything routed through `user_in_org_admin_scope_v2`) already block correctly — no change needed there.
- The UI lets the org admin click "Reinstate access" because `canManageSuspension` doesn't consider who suspended.

## Changes

### 1. RLS — block org-admin writes on suspended orgs
Migration updating these policies to add `AND NOT is_org_suspended(<org id>)` on the USING / WITH CHECK:
- `training_organizations` → `Org admins can suspend own org` (UPDATE)
- `certification_catalog` → `Org admins manage org catalog` (ALL)
- `funding_goals` → `Org admins manage org goals` (ALL)
- `qr_codes` → `Org admins manage own org qr codes` (ALL)
- `org_suspension_audit` → `Org admins insert own org suspension audit` (INSERT)

Result: while `suspended_at IS NOT NULL`, org admins can still **read** existing rows but cannot insert/update/delete anything org-scoped. Only a platform admin can reinstate.

### 2. UI — `OrganizationDetail.tsx`
- When `organization.suspended_at` is set and the current user is **not** a platform admin, hide the "Reinstate access" button.
- Replace it with a small read-only notice: "Only a platform administrator can reinstate this organization."
- The suspension banner shown to members (`OrgSuspendedBanner`) already covers messaging on every other page; no changes there.

### 3. Verification
- Confirm an org admin signed into a suspended org sees the banner, the detail page shows no action button, and any direct attempt to update the org / catalog / goals / QR codes fails with RLS.
- Confirm a platform admin can still suspend and reinstate normally.

## Out of scope
- No data model changes; no new tables.
- No changes to read access (org admins keep visibility into their existing data while suspended — only writes are blocked).