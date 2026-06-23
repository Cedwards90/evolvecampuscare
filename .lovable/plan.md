## Root cause

For Dominic specifically:
- `auth.users.email` is normalized to lowercase by Supabase: `dominiheath5007@gmail.com`.
- `user_invitations.email` was saved as typed: `Dominiheath5007@gmail.com`.
- The `handle_invited_signup` trigger matches with `WHERE email = NEW.email` (case-sensitive), so the invitation lookup misses on any invite created with a capital letter. As a result `accepted_at` never gets set and any invitation-driven side effects (role swap, org membership, auto-assign CM) never run.
- His profile, student role, org membership, and student file all exist (they were filled in later by other flows), so once the invitation is marked accepted he will stop showing as "Invitation pending" and Student Folders should list him on the next refresh.

This is a recurring bug: every invited user whose email contains uppercase letters will get stuck the same way.

## Fix (permanent + backfill)

1. **Make the signup trigger case-insensitive** — update `public.handle_invited_signup` so the invitation lookup and the "mark all pending accepted" update use `lower(email) = lower(NEW.email)` instead of `=`.

2. **Normalize stored invitation emails going forward** — add a `BEFORE INSERT/UPDATE` trigger on `public.user_invitations` that does `NEW.email := lower(trim(NEW.email))`. Belt-and-suspenders so even if a future code path inserts a mixed-case address the trigger still matches.

3. **Lowercase in the edge function too** — in `supabase/functions/generate-invitation-token/index.ts`, lowercase + trim `email` before insert (and validation). Keeps the data clean at the source.

4. **One-time backfill** for users already stuck:
   - `UPDATE public.user_invitations SET accepted_at = now() WHERE accepted_at IS NULL AND lower(email) IN (SELECT lower(email) FROM auth.users WHERE confirmed_at IS NOT NULL);`
   - Lowercase existing rows: `UPDATE public.user_invitations SET email = lower(trim(email)) WHERE email <> lower(trim(email));`
   - This clears Dominic and any other invitee whose signup already happened but whose invitation row never flipped.

## Out of scope / verification

No frontend changes. After the migration runs, refresh `/admin/users` — Dominic should disappear from the Pending Invitations list, and he should already be in Student Folders (his profile, role, and org membership are intact in the DB). If he's still missing from Student Folders after that, it's a separate UI filter issue and we'll diagnose from there.