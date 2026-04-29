## Root cause

Your sidebar IS rendering on `/dashboard` — your screenshot shows the "NAVIGATION" label and the "Support Center" promo card. The nav links between them are empty because:

1. `SidebarLayout` filters nav items with `role && item.roles.includes(role)`.
2. Your currently signed-in user (avatar shows **"U"**, not "A" for admin) has **no row in `user_roles`** — so `role` is `null` and every item is filtered out.
3. The DB confirms ~20 recent users (students who signed up) have no role assigned. Only 3 admins (`admin@evolvefoundation.us`, `jbester@gechamber.com`, `jmac@evolvefoundation.us`) have rows in `user_roles`.

So this is a **data/onboarding bug**, not a layout bug. The fix has three parts.

## Plan

### 1. Backfill missing roles (migration)

Insert `('user_id', 'student')` into `user_roles` for every user in `profiles` who currently has no role row. Safe default — the 20 unassigned accounts all look like students who signed up via the public flow.

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'student'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.user_id IS NULL;
```

### 2. Ensure new signups always get a role (trigger)

Check whether the existing `handle_new_user`/profile-creation trigger also inserts into `user_roles`. If it doesn't, update it (or add a sibling trigger) so every new `auth.users` row gets a default `'student'` role inserted alongside the profile. This prevents the bug from recurring.

If the invitation flow already assigns a role (Case Manager / Admin invites), it must continue to take precedence — the trigger only inserts a default when no role row exists yet.

### 3. Make the sidebar fail-safe (UX guardrail)

Even with the data fixed, `role` is briefly `null` while `fetchUserData` is loading, and could be `null` for any future edge case. Update `SidebarLayout` so that when `role` is `null`:
- Show a loading skeleton for the nav while `useAuth().isLoading` is true, OR
- Show a minimal "common" nav (Dashboard, Settings, Help Center) and a small "Your account is missing a role — contact an administrator" notice when not loading.

This way the sidebar can never silently render as a blank strip again.

### Files to change

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Backfill missing student roles + add/extend trigger to default-assign role on signup |
| `src/components/layouts/SidebarLayout.tsx` | Loading skeleton + missing-role fallback UI |

No other components, routes, or auth flows need to change. Admins like `admin@evolvefoundation.us` already have correct roles and will see the full sidebar immediately on next reload.

### Verification after build

1. Reload `/dashboard` as your current user → nav items appear.
2. Sign in as `admin@evolvefoundation.us` → all admin items (User Management, Organizations, Surveys, Admin Dashboard) appear.
3. Create a brand-new test signup → confirm it gets `student` role and full student nav appears immediately.
