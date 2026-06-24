## Goal

Give admins a way to see when users last signed in, plus a running history of logins going forward. Backfill the history with each user's most recent sign-in that Lovable Cloud already tracks (`auth.users.last_sign_in_at`) so the page isn't empty on day one.

Note: Lovable Cloud's auth only stores the *most recent* sign-in per user — it does not keep a per-login history. We can backfill exactly one historical row per user (their last sign-in to date); new logins from this point forward will be captured individually.

## What gets built

### 1. New table `public.user_login_events`
Append-only log, one row per sign-in.

- `id uuid pk`
- `user_id uuid` (references `auth.users(id)` via app code, no FK to auth)
- `signed_in_at timestamptz`
- `source text` — `'backfill'` for the seeded row, `'client'` for live sign-ins
- `created_at timestamptz default now()`

Indexes on `(user_id, signed_in_at desc)` and `(signed_in_at desc)`.

RLS:
- Admin and org_admin can `SELECT` (org_admin scoped to users in their org via existing `user_in_org_admin_scope_v2`).
- `INSERT` allowed for the authenticated user inserting their own row (so the client can log live sign-ins).
- No UPDATE/DELETE for anyone except service_role.

Grants: `SELECT, INSERT` to `authenticated`; `ALL` to `service_role`.

### 2. Backfill migration
One historical row per user using `auth.users.last_sign_in_at` (skip users who have never signed in):

```sql
INSERT INTO public.user_login_events (user_id, signed_in_at, source)
SELECT id, last_sign_in_at, 'backfill'
FROM auth.users
WHERE last_sign_in_at IS NOT NULL;
```

### 3. Live capture in `AuthContext`
On `SIGNED_IN` events from `onAuthStateChange`, insert a row into `user_login_events` with `source: 'client'`. Dedupe in code: only insert if the last logged event for this user is more than 5 minutes ago (so token refreshes and tab focus don't flood the table).

### 4. Admin page `/admin/login-activity`
New route, admin + org_admin only, linked from the Admin sidebar.

Two sections:
- **Summary table** — one row per user: name, email, role, organization, last sign-in (relative + absolute), total logins recorded. Sortable by last sign-in. Search by name/email. Respects existing global org/cohort filters where applicable.
- **Recent activity feed** — most recent 100 login events across the platform with user name, time, and source.

Pull data via two queries: an aggregated `user_id → max(signed_in_at), count(*)` joined to `profiles` + `user_roles`, and a recent-events list joined to `profiles`.

### 5. Sidebar entry
Add "Login Activity" under the existing Admin section of `SidebarLayout`, visible to `admin` and `org_admin`.

## Out of scope

- No edits to `auth` schema, no auth triggers (Lovable rule).
- No IP/user-agent tracking — that would need an edge function and wasn't requested.
- No changes to existing settings, profile, or notification flows.

## Technical notes

- Live logging happens client-side in `AuthContext` after `onAuthStateChange` fires `SIGNED_IN`. Wrapped in try/catch so a failed insert never blocks auth.
- Org_admin scoping reuses the existing `user_in_org_admin_scope_v2(_actor, _target_user)` helper inside an RLS policy.
- The page reuses existing `PageHeader`, table primitives, and `TimeAgo` component for consistent styling.
