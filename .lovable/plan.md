## Root cause

You're signed in as `admin@evolvefoundation.us` (confirmed: MFA verified, role `admin` in DB). But the sidebar only shows the items everyone gets (Dashboard, Messages, Settings) — Admin Dashboard, User Management, Organizations, Surveys, Student Folders are missing.

The bug is in `AuthContext.fetchUserData`:

```ts
const { data: roleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .order('created_at', { ascending: true })
  .limit(1)
  .single();
```

Two problems:

1. **Wrong role priority.** `.order('created_at')` picks the *oldest* role row. If a user was first inserted as `student` (default from `handle_new_user`) and then upgraded to `admin`, this query returns `student`. The DB already has a `get_user_role()` function that orders by role priority (admin → case_manager → student) — but the frontend ignores it.
2. **Silent failures.** `.single()` throws when the result has 0 rows or an unexpected shape; the destructured `data` is then `null` and the `if (roleData)` branch is skipped without logging anything visible. Combined with the RLS skeleton swap, the sidebar ends up rendering with `role = null` after `isLoading` flips to `false`, falling through to "no role assigned" — and on the mobile/legacy path, just the common items.

A second smaller issue: the **mobile sidebar** (`mobileMenuOpen` block in `SidebarLayout.tsx`) doesn't apply the same role-aware loading/empty fallback as desktop, but the role bug above is the real issue.

## Plan

### 1. Use the DB's role-priority function (frontend)

In `src/contexts/AuthContext.tsx` `fetchUserData`, replace the `user_roles` query with a call to the existing Postgres function:

```ts
const { data: roleData, error: roleError } = await supabase
  .rpc('get_user_role', { _user_id: userId });

if (roleError) console.error('Role fetch error:', roleError);
if (roleData) setRole(roleData as AppRole);
```

`get_user_role` already returns the highest-priority role (`admin` > `case_manager` > `student`) and is `SECURITY DEFINER`, so it bypasses RLS edge cases and is faster.

Also fetch profile + role **in parallel** with `Promise.all` so the UI doesn't wait twice.

### 2. Add a visible debug surface (one-time, removable)

Inside `fetchUserData`, after both fetches, log a single concise line:

```ts
console.log('[Auth]', { userId, role: roleData, profile: !!profileData });
```

This makes it trivial to confirm in the browser console that the admin role is actually arriving. Remove later if noisy.

### 3. Mirror the desktop fallback in the mobile sidebar

In `SidebarLayout.tsx`, the mobile `<aside>` block currently maps `filteredNavItems` unconditionally. Wrap it with the same `isLoading` skeleton and `!role` fallback used in the desktop nav so behavior is consistent on phones.

### 4. Verify

1. Reload `/dashboard` as `admin@evolvefoundation.us` → the sidebar should show: Dashboard, Manage Requests (no — admin doesn't get this), **Admin Dashboard, User Management, Organizations, Surveys, Student Folders, Messages, Settings**.
2. Sign in as a case manager → should see: Dashboard, Manage Requests, Student Folders, Messages, Surveys, Settings.
3. Sign in as a student → should see: Dashboard, Submit Request, Track Requests, Offline Drafts, Messages, Settings.
4. Console should print `[Auth] { role: 'admin', profile: true }`.

### Files to change

| File | Change |
|---|---|
| `src/contexts/AuthContext.tsx` | Use `get_user_role` RPC; parallelize profile+role fetch; add one debug log |
| `src/components/layouts/SidebarLayout.tsx` | Apply loading/empty fallback to mobile sidebar block too |

No DB migration needed — `get_user_role` already exists.