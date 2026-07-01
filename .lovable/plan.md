## Goal
Back the existing `useFormPersistence` hook with a Supabase-backed draft store so in-progress form data survives Chrome tab discards, device switches, and localStorage clears — not just page reloads on the same device.

## Why
Today drafts live only in `localStorage`. When Chrome discards a tab under memory pressure and later restores it, the site sometimes reloads from a clean state on a different profile/window where the localStorage entry isn't present (or was evicted), and users lose progress. A server-side copy keyed to the user + form makes recovery reliable across tabs, devices, and reloads.

## Approach

### 1. New `form_drafts` table (Cloud / Supabase)
One row per (user, form key). Small, JSON-only, no PII beyond what the user already typed.

Columns:
- `user_id` (uuid, FK auth.users)
- `form_key` (text) — e.g. `weekly-checkin`, `lifeskills-survey`, `cmf-basics-onboarding`
- `values` (jsonb) — sanitized draft payload
- `saved_at` (timestamptz)
- Primary key: `(user_id, form_key)`

RLS: user can only read/write their own row. Explicit GRANTs to `authenticated` and `service_role`. No `anon` access.

### 2. Extend `useFormPersistence`
- Keep localStorage as the fast synchronous layer (unchanged behavior for typing latency).
- Add a debounced background upsert to `form_drafts` (~2s after typing settles, plus a forced flush on `visibilitychange`, `pagehide`, and `beforeunload`).
- On mount:
  1. Load local draft synchronously (current behavior) so restore is instant.
  2. Fire a background fetch of the server draft. If server `saved_at` is newer than local, hydrate form state from server and refresh localStorage.
- On successful `clear()` (form submitted or discarded), delete the server row alongside the local one.

### 3. Flush reliability for tab discard
- Use a single `flushNow()` path shared by debounce, `visibilitychange` (hidden), `pagehide`, and `beforeunload`.
- For the tab-hide path, use `navigator.sendBeacon` against a lightweight edge function OR a direct `supabase.from('form_drafts').upsert()` with `keepalive`-style fetch — whichever the Supabase client supports. If neither is reliable, add a tiny `save-form-draft` edge function that accepts a beacon POST with the user's JWT.

### 4. Coverage
No new forms wired this pass — the hook already covers Weekly Check-In, Life Skills Survey, Intake Survey, Post-Graduation Plan, Support Request, Complete Profile, Career Intake, CMF Basics, Personality Quiz, NDA editor, Schedule Meeting, and Case Notes. They all inherit server persistence automatically once the hook is upgraded.

### 5. Housekeeping
- Add a scheduled cleanup (pg_cron, daily) that deletes `form_drafts` rows older than 30 days to keep the table bounded.
- Do NOT persist auth/password/invite-token forms (explicit denylist in the hook — already excluded).

## Technical details

- Migration creates `public.form_drafts` with the schema above, GRANTs, RLS (`auth.uid() = user_id` for all commands), and an updated_at trigger.
- Hook changes are confined to `src/hooks/useFormPersistence.ts` and `src/lib/formDraftStorage.ts`; no component-level changes needed.
- Conflict resolution rule when server and local drafts both exist: newest `saved_at` wins. Ties break to local (already in the UI).
- Sanitization (Files/Blobs stripped, Dates → ISO) already handled in `formDraftStorage`; server payload reuses the same sanitized object.
- Network failures during save are swallowed silently — localStorage remains the source of truth for that session.

## Out of scope
- No admin UI for viewing drafts.
- No conflict-merge UI; last-write-wins per form.
- No changes to the separate offline support-request drafts system (`offline_drafts` / IndexedDB) — that flow is unrelated.
