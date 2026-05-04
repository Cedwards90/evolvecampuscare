# QR Code Access for Student Actions

## Goal
Let organizations print a QR poster that students scan to quickly submit a request or schedule a meeting on mobile, with secure login and full funnel analytics.

## User Flow
1. Admin generates an org QR (or student opens their personal QR shortcut in Settings) → downloads PNG/PDF.
2. Student scans poster → lands on `/qr/:code` (mobile-optimized action page with two big buttons: **Submit a Request** / **Schedule a Meeting**).
3. If not logged in → redirect to `/auth?redirect=/qr/:code` with "Remember this device for 30 days" checkbox. After login, returns to action page.
4. Student picks an action → routed to existing `/submit-request` or meeting scheduler, with a hidden `qr_session_id` carried through so the resulting request/meeting is tagged.
5. Submissions/meetings appear in dashboards as today, plus a QR origin badge.

## Data Model (new migration)

**`qr_codes`** — one row per generated code
- `code` (text, unique short slug for URL), `organization_id` (nullable for global), `label`, `created_by`, `is_active`, `created_at`

**`qr_scan_events`** — full funnel
- `qr_code_id`, `session_id` (uuid generated client-side, persisted in localStorage for the scan), `user_id` (nullable until login), `event_type` enum: `scan` | `auth_required` | `auth_completed` | `action_selected` | `action_started` | `action_completed`, `action_kind` (`request` | `meeting`, nullable), `target_id` (uuid of created request/appointment, nullable), `user_agent`, `created_at`

**Tagging** — add `qr_session_id uuid` nullable to `support_requests` and `appointments` so we can join back to the funnel without changing existing flows.

**RLS:**
- `qr_codes`: Admins manage all; Org admins manage own org's codes; authenticated users can SELECT active codes (needed for landing page lookup).
- `qr_scan_events`: anyone authenticated can INSERT their own session events; Admins/Org admins SELECT scoped to their org's qr_codes; users can SELECT their own events.

## Frontend

**New files only** (no edits to existing pages beyond two narrowly-scoped additions):
- `src/pages/QRLanding.tsx` — route `/qr/:code`. Mobile-first, large pill buttons, Evolve branding. Logs `scan` then `action_selected` events. Stores `qr_session_id` in sessionStorage.
- `src/pages/admin/QRCodesPage.tsx` — list/create/deactivate codes, preview, download PNG and printable PDF poster, view per-code analytics (scans, conversion to submission/meeting, top times).
- `src/components/qr/QRPosterPreview.tsx` — printable poster with logo + instructions + QR.
- `src/components/qr/StudentQRShortcut.tsx` — small card shown in `Settings.tsx` letting a student view/save the org QR for their own phone.
- `src/hooks/useQRSession.ts` — reads/writes `qr_session_id` from sessionStorage and exposes a `logEvent` helper.
- `src/lib/qr.ts` — generate QR via `qrcode` library (already a tiny dep to add).

**Minimal additions to existing files** (only what's strictly required to wire it up):
- `src/App.tsx` — add `/qr/:code` and `/admin/qr-codes` routes.
- `src/pages/Auth.tsx` — honor `?redirect=` param and "Remember this device" checkbox (sets longer session via `supabase.auth.setSession` persistence flag in localStorage).
- `src/pages/SubmitRequest.tsx` and the meeting scheduler — read `qr_session_id` from sessionStorage on mount, include it on insert, then log `action_completed` with `target_id`. (One-line additions, no logic changes.)
- `src/pages/Settings.tsx` — render `<StudentQRShortcut />` if student role.
- Admin sidebar — add link to QR Codes page (org admins see only their org's codes).

## Tracking & Sync
- Realtime: existing dashboards already query `support_requests` / `appointments` — no changes needed; new rows simply carry `qr_session_id`.
- Admin QR analytics page shows: total scans, unique sessions, % auth completed, % action started, % action completed, breakdown by request vs meeting.

## Security
- Rate-limit scan event inserts via simple per-session debounce (client) + DB unique on `(session_id, event_type, action_kind)` where applicable to prevent log spam.
- QR code slug is non-guessable but not secret (it's printed on a poster); auth is still required for any action.
- "Remember this device" uses Supabase's built-in session persistence — no custom token storage.
- No new secrets needed.

## Out of Scope
- Per-student personal QR codes (decided: org-wide only).
- Magic-link auto-login from QR.
- Editing the existing request/meeting forms beyond reading one sessionStorage value.

## Technical Details
- New dep: `qrcode` (~50KB) for client-side QR PNG generation; `jspdf` already commonly used or we use browser print for poster PDF.
- Migration adds: `qr_codes`, `qr_scan_events` tables + `qr_session_id` columns + RLS policies + indexes on `(qr_code_id, created_at)` and `(session_id)`.
- All new UI uses existing Forest Green / Sage tokens and `rounded-full` pill style per brand memory.
