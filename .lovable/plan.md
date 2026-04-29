# Fix: Sidebar nav items disappear after sign-in

## Problem

After signing in and reaching the Dashboard, the left sidebar shell renders but its menu items can be empty.

## Root cause

`src/components/layouts/SidebarLayout.tsx` filters every nav item with:

```text
g.items.filter(i => role && i.roles.includes(role))
```

When `role` is `null` (still being fetched), `filteredGroups` becomes `[]` and the sidebar renders with **no menu items**. Two situations expose this:

1. **First render after sign-in.** `AuthContext` fetches `profile` and `role` asynchronously. There is a window where `user` is set but `role` is still `null`.
2. **Dashboard skeleton state.** Batch C wraps the skeleton in `<SidebarLayout>` and returns early while `requestsLoading` is true. The sidebar renders, but if `role` hasn't resolved yet, items are empty.

Once `role` resolves, React re-renders and items appear — but if the user navigates or the auth event sequence stalls, the sidebar stays empty until the next state change.

## Fix

1. **Render a sidebar skeleton when role is loading.** In `SidebarLayout.tsx`, when `auth.isLoading` is `true` or `role` is `null` but `user` exists, render lightweight placeholder rows in the nav (3–4 muted skeleton bars) instead of an empty `<nav>`. This matches the rest of the Batch C skeleton work and removes the "blank menu" perception.

2. **Stop nav from collapsing when filtered list is empty.** Change the filtered-groups calculation so a temporary `null` role does not produce zero items — fall back to a "loading" placeholder array that the render path knows how to display.

3. **Confirm `useAuth` exposes `isLoading`.** It already does (`AuthContext.tsx` line 11). Use it directly in `SidebarLayout`.

No business logic changes. No route or data-fetching changes. Only the rendering branch in `SidebarLayout.tsx`.

## Files touched

- `src/components/layouts/SidebarLayout.tsx` — add `isLoading` from `useAuth`, render a 4-row skeleton inside `<nav>` while `isLoading || (user && !role)`. Apply the same to the mobile sidebar.

## Out of scope

- Refactoring `AuthContext` fetch order.
- Changing the role-permissions model.
- Visual redesign of the sidebar.

## Validation

- Sign in as admin / case manager / student and confirm menu items appear immediately (skeleton during the brief load window, then real items).
- Refresh on `/dashboard`, `/admin-monitoring-reassigning-requests`, and `/case-manager-managing-student-requests` — sidebar must not flash empty.
- Mobile viewport: open the sidebar drawer and confirm same behavior.
