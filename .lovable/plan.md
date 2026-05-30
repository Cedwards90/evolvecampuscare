## Problem

Toggling a user's active/inactive state fails with "Failed to update status. Failed to send a request to the edge function."

### Root cause

- `supabase.functions.invoke('set-user-active', ...)` returns an SDK-level FunctionsFetchError ("failed to send a request"), which means the response never reached the client.
- Supabase edge logs for `set-user-active` show **zero requests**, even though the function has booted recently. The request is being rejected at the gateway before reaching the function runtime.
- `supabase/config.toml` lists every other custom edge function with `verify_jwt = false`, but `set-user-active` is missing. Under the new signing‑keys system the gateway then defaults to enforcing JWT verification, and the admin's session JWT is bounced (likely because privileged users are at AAL1 until they complete MFA on this device, or because the project's JWT secret rotation isn't being honoured for this function). Either way, the gateway rejects the request and the SDK reports it as a network failure.
- The function already validates the user in code (`auth.getUser()` + `user_roles.role = 'admin'`), so disabling gateway JWT verification is safe and matches the convention used by every other admin function in this project.

### Secondary issue

`sanitizeError(err)` is called with one argument inside `set-user-active/index.ts`, but the shared helper signature is `sanitizeError(error, context)`. This still works but loses the log context.

## Changes

1. **`supabase/config.toml`** — add a config block for the function so the gateway stops blocking it:

   ```toml
   [functions.set-user-active]
     verify_jwt = false
   ```

   No other entries in the file change.

2. **`supabase/functions/set-user-active/index.ts`** — pass a context string to `sanitizeError` so server‑side logs remain useful:

   ```ts
   return json({ error: sanitizeError(err, 'set-user-active') }, 500);
   ```

3. **Verification** — after redeploy:
   - Call the function with `supabase--curl_edge_functions` as the logged‑in admin and confirm a `200 { success: true }`.
   - Toggle a non‑admin user from Admin → User Management and confirm the optimistic UI update sticks and the audit row appears in `user_status_audit`.
   - Re‑check `supabase--edge_function_logs set-user-active` to confirm the invocation now shows up.

## Out of scope

No changes to RLS, the audit table, the `useSetUserActive` hook, or any UI. The fix is intentionally minimal — only the gateway configuration and the one logging argument.
