# Fix: "infinite recursion detected in policy" on profiles & training_organizations

## What's broken
All Data API reads of `profiles` and `training_organizations` are returning HTTP 500 with `42P17 infinite recursion detected in policy`. That's why the admin sees "No users found" and empty org/case-manager lists everywhere — `UserManagement`, global filter options, impact dashboard, etc.

## Root cause
Two policies reference each other via **inline subqueries** (not via `SECURITY DEFINER` helpers), creating a mutual loop the planner detects as recursion:

- `training_organizations` policy **"Users can view their own org"** runs an inline `SELECT organization_id FROM profiles WHERE user_id = auth.uid()`.
- `profiles` policy **"Org admins view profiles via membership"** runs an inline `EXISTS … JOIN training_organizations …`.

Because each inline subquery is evaluated as the caller (invoker), the other table's RLS kicks in, which re-enters the first table's RLS → recursion. The existing `SECURITY DEFINER` helpers (`is_org_admin`, `is_org_admin_of`, `is_user_org_suspended`, etc.) sidestep this; the two policies above were written without using them.

Nothing else in the schema was actually changed in the recent Impact work — the recursion has been latent and is being surfaced by reads that exercise both tables in the same query plan.

## Fix (one migration)

1. Add two small `SECURITY DEFINER STABLE` helpers in `public`:
   - `get_user_org(_user_id uuid) returns uuid` — returns `profiles.organization_id` for the given user. Used by the `training_organizations` self-view policy.
   - `org_admin_sees_user(_admin uuid, _user uuid) returns boolean` — returns true when `_admin` is an org_admin of any active (non-suspended) org that `_user` is a current member of. Used by the profiles membership policy.
   Both run with `search_path = public`, owned by `postgres`, and bypass RLS the same way the existing helpers do.

2. Replace the two recursive policies:
   - `DROP POLICY "Users can view their own org" ON public.training_organizations;` then recreate it as:
     `USING (id = public.get_user_org(auth.uid()) OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = auth.uid() AND m.organization_id = training_organizations.id AND m.left_at IS NULL))`
     (the memberships EXISTS does not touch profiles or training_organizations recursively, so it's safe to keep inline).
   - `DROP POLICY "Org admins view profiles via membership" ON public.profiles;` then recreate it as:
     `USING (public.org_admin_sees_user(auth.uid(), user_id))`.

3. No GRANT changes, no column changes, no app code changes.

## Verification
After the migration:
- `select count(*) from public.profiles;` and `select * from public.training_organizations limit 1;` succeed (run via `supabase--read_query` as a smoke test).
- Reload `/admin/users`, `/admin/impact`, and the global filter bar; user list, org filter, and case-manager dropdown populate again.
- Console no longer shows `42P17` errors.

## Out of scope
- No changes to other policies, to roles, to MFA, or to any frontend code.
- No changes to the recent Impact org-breakdown work.
