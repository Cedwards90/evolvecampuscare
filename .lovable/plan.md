## Goal
Let case managers browse the resource library and contribute new entries (and edit ones they added), without giving them admin-wide delete/edit powers over the full catalog.

## Changes

### 1. Database (RLS on `community_resources`)
Add policies so case managers and org admins can contribute:
- `INSERT` allowed for `case_manager` and `org_admin` (rows they create are visible to everyone via the existing active-read policy).
- `UPDATE`/`DELETE` allowed for `case_manager`/`org_admin` **only on rows they created** (tracked via existing/owner column — add `created_by uuid` column defaulting to `auth.uid()` if not present).
- Admin policy stays unchanged (full control).

If `created_by` doesn't exist on `community_resources`, add the column + backfill `NULL` (existing rows remain admin-only to edit).

### 2. Route / Access
- Change `/admin/resources` guard from `['admin']` to `['admin','case_manager','org_admin']` so case managers reach the management UI.
- Keep sidebar "Manage Resources" link, expanding `roles` to include `case_manager` and `org_admin`.

### 3. `ResourcesAdmin.tsx` UI tweaks
- Rename page header to "Resource Library" for non-admins (admins still see full management).
- Hide Edit/Delete buttons on rows the current user didn't create (unless admin). Add a small "Added by you" badge on rows the user owns.
- On create, the new `created_by` is set automatically by the DB default; no UI change needed for the form.
- Everyone with access keeps the "Add resource" button.

### 4. No changes to
- `Resources.tsx` student-facing browse page.
- Recommendation flow / `StudentResourcesPanel`.
- Edge functions.

## Files touched
- `supabase/migrations/<new>.sql` — add `created_by`, new RLS policies.
- `src/App.tsx` — expand `allowedRoles` for `/admin/resources`.
- `src/components/layouts/SidebarLayout.tsx` — expand `roles` on "Manage Resources" link (and maybe rename to "Contribute Resources" for non-admins).
- `src/pages/admin/ResourcesAdmin.tsx` — ownership-aware action buttons + dynamic title.
- `src/hooks/useCommunityResources.ts` — include `created_by` in select.
