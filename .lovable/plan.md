## Fix: Case managers and org admins can add community resources

The database and admin route already allow case managers and org admins to create/edit their own resources (RLS + `/admin/resources` guard). The gap is UX: staff normally land on `/resources` (the browse page), which has no "Add" button, so they never discover the capability.

### Changes

1. **`src/pages/Resources.tsx`**
   - Read `role` from `useAuth`.
   - When `role` is `admin`, `case_manager`, or `org_admin`, show an "Add resource" button in the `PageHeader` that navigates to `/admin/resources` (opens the existing manage view where the add dialog already lives).
   - Also show a subtle "Manage resources I added" link next to it for the same roles.
   - Leave students' view unchanged.

2. **`src/components/layouts/SidebarLayout.tsx`**
   - Rename the staff sidebar entry from "Manage Resources" to "Add/Manage Resources" so CMs and org admins can find it. (Route already permits all three staff roles.)

3. **`src/pages/admin/ResourcesAdmin.tsx`** (small polish, no behavior change to permissions)
   - Update the page title from "Community Resources" (admin copy) to something clearer for non-admins already handled by the existing `isAdmin ? … : …` description — verify nothing gates the "Add resource" button on `isAdmin` (it doesn't today; keep as-is).

No DB migration required — existing policies already allow staff inserts with `created_by = auth.uid()` and self-edit/delete.

### Verification
- Sign in as case_manager → `/resources` shows Add button → click → land on `/admin/resources` → add a resource → row appears with "Added by you" badge and edit/delete controls.
- Sign in as org_admin → same flow works.
- Sign in as student → no Add button, browse-only.
