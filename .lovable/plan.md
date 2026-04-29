## Root cause

Console shows:
```
permission denied for function has_role
permission denied for function get_user_role
```

The `authenticated` Postgres role does not have `EXECUTE` on these `SECURITY DEFINER` functions. Because `has_role(...)` is referenced in nearly every RLS policy (including `profiles`), all role-gated reads silently fail. The `AuthContext` then sets `role = null` and `profile = null`, and `SidebarLayout` renders the "no role assigned" empty state — for every user, including admin.

So this is not a UI bug first; it's a database grant bug. The UI hardening is still useful as a safety net.

## Plan

### 1. Database fix (primary — unblocks everything)

Migration to grant execute on the role-helper functions to authenticated users:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
```

Both functions are already `SECURITY DEFINER` with a pinned `search_path`, so granting EXECUTE is safe and does not widen data access — RLS on `user_roles` still applies via the definer's logic.

After this, `admin@evolvefoundation.us` will receive `role = 'admin'` and the full sidebar (Admin Dashboard, User Management, Organizations, Surveys, Student Folders) will render with no further code changes.

### 2. Auth context hardening

In `src/contexts/AuthContext.tsx`:
- Surface a `roleError` state when `get_user_role` returns an error (vs. legitimately no role) so the UI can distinguish "permission/network problem" from "user genuinely has no role yet".
- Keep the existing `Promise.all` + `maybeSingle` + `get_user_role` RPC pattern.
- Remove the temporary `[Auth]` console.log now that the issue is identified.

### 3. Sidebar fallback (safety net)

In `src/components/layouts/SidebarLayout.tsx` (desktop + mobile nav blocks), when `!isLoading && !role`:
- Always show a minimum safe nav: **Dashboard**, **Settings**, **Help Center**.
- Show a small banner: "Your account is being set up. Contact your administrator if this persists." with a mailto link to the configured admin email.
- If `roleError` is set, swap the message to: "We couldn't load your account permissions. Please refresh, or contact your administrator." with a Retry button that calls `refreshProfile()`.

This guarantees a logged-in user is never stranded on a blank shell, regardless of future RLS regressions.

### 4. ProtectedRoute consistency

In `src/components/layouts/ProtectedRoute.tsx`:
- Keep current loading spinner behavior.
- When `user` exists but `role` is null and `allowedRoles` is set, redirect to `/dashboard` (already happens implicitly) and let the dashboard show the fallback banner from step 3 instead of bouncing the user to `/auth`.
- No change needed for the public `/dashboard` route since it has no `allowedRoles`.

### 5. Live role updates (no extra plumbing needed)

`onAuthStateChange` already calls `fetchUserData` on every auth event, and `refreshProfile()` is exposed on the context. Admin user-management screens that change a role should call `refreshProfile()` for the affected current session; cross-user realtime updates are out of scope for this fix (would require a `user_roles` realtime subscription — flag as future work, not part of this plan).

### Files touched

- New migration: grant EXECUTE on `has_role` and `get_user_role`
- `src/contexts/AuthContext.tsx` — add `roleError`, drop debug log
- `src/components/layouts/SidebarLayout.tsx` — fallback nav + banner (desktop + mobile)
- `src/components/layouts/ProtectedRoute.tsx` — minor: don't redirect away from `/dashboard` when role is null

### Verification

1. After migration, hard-refresh as `admin@evolvefoundation.us` → console `[Auth]` (before removal) shows `role: "admin"` and full admin sidebar appears.
2. Temporarily revoke EXECUTE locally (or simulate by signing in as a brand-new user with no `user_roles` row) → fallback banner + Dashboard/Settings/Help links render instead of empty sidebar.
3. Confirm Case Manager and Student logins still see only their permitted nav items.
