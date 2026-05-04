## Goal

Make each QR code admin-editable (destination, title, description, active state) and route students to a single universal request form. Allow either authenticated submission or guest email verification, then attach the request to the matching student profile.

## Scope guardrails

- Only QR-flow files change: `qr_codes` table, `QRLanding.tsx`, `QRCodesPage.tsx`, `SubmitRequest.tsx` (read-only QR-context wiring), and one new Edge Function.
- No changes to messaging, dashboards, RLS for support_requests, case-manager logic, or notification routing.
- Existing `/qr/<code>` links keep working — new columns get safe defaults via migration.

## 1. Database (migration)

Add columns to `qr_codes` (all nullable / defaulted so existing rows stay valid):

- `destination_type text NOT NULL DEFAULT 'request'` — one of `request`, `meeting`, `external`
- `destination_url text NULL` — used only when `destination_type = 'external'`
- `title text NULL` — overrides default landing headline
- `description text NULL` — overrides default landing subtext
- `prefill_category request_category NULL` — optional default for the universal form
- (keep existing `label`, `is_active`, `organization_id`)

Backfill: set `destination_type='request'`, copy `label` into `title` where `title` is null. RLS unchanged (admin/org-admin manage; authenticated read active).

## 2. Admin editor (`/admin/qr-codes`)

Extend the existing create dialog and add an **Edit** dialog for the selected QR card:

- Title, description (textarea), destination type (radio: Request form / Schedule meeting / External URL), external URL (shown only for external), prefill category (select, optional), active toggle (already present).
- Validate: external URL required and `https://` when type = external; title ≤ 80 chars; description ≤ 280.
- Save updates `qr_codes` and invalidates `qr-codes` query. Existing funnel analytics block unchanged.

## 3. QR landing (`/qr/:code`)

- Fetch new fields. Render `title`/`description` if present (fallback to current copy).
- If `destination_type = 'external'` → log `action_selected` then `window.location.replace(destination_url)`.
- If `request` → single primary CTA "Submit a request" → `/student/support-request?source=qr&qr=<code>` (carries category prefill via query).
- If `meeting` → existing schedule flow.
- Staff-block behavior preserved.
- Guest path (no user): show two options on the landing — **Sign in** or **Continue with email** (magic link). New "Continue with email" calls a new Edge Function `qr-guest-start` (see §5) and shows "Check your email" state. Email link returns to `/qr/<code>` authenticated; existing `auth_completed` logging continues.

## 4. Universal form (`SubmitRequest.tsx`)

Minimal additions only:

- Read `qr` query param; if present, fetch the QR row (id, title, description, prefill_category) and:
  - Show a small banner "Submitting via {title}".
  - Preselect category from `prefill_category` (user can change).
- After successful submit (existing `useSubmitRequest` already records `qr_session_id`): redirect to `/track-requests/<id>` (existing route) instead of dashboard, so the student lands on their own request status page.
- No business-logic changes; assignment + visibility flow unchanged (existing RLS already attaches the row to `auth.uid()` as `student_id`, which case managers and reports already consume).

## 5. Guest email verification (Edge Function `qr-guest-start`)

- Public function (verify_jwt = false), strict CORS, Zod validation on `{ email, qrCode }`.
- Looks up active QR by `code`. Rejects if not active.
- Calls `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${SITE_URL}/qr/${qrCode}?verified=1` } })`.
- Sends the link via the project's built-in transactional email (`send-transactional-email`) with subject "Verify your email to submit a request". No new secrets.
- Logs a `qr_scan_events` row with `event_type='auth_required', action_kind='request'`.
- On magic-link return, the existing `handle_new_user` trigger creates the profile + student role, so the universal form binds the request to the new account automatically.

## 6. Backwards compatibility

- All existing QR codes continue to work (defaults to `request` destination, same UI).
- Old funnel analytics keep functioning (no event-type changes).
- No support_requests schema or RLS changes — case-manager dashboards, reports, and student tracking automatically pick up new submissions.

## Verification checklist

1. Existing `/qr/<old-code>` still loads and routes to request flow.
2. Admin edits title/description/destination → landing updates immediately.
3. External destination redirects out cleanly and logs `action_selected`.
4. Logged-in student submits via QR → request appears in their `/track-requests`, in assigned case manager's queue, and in admin reports with `qr_session_id` set.
5. Guest "Continue with email" → magic link → returns authenticated → submits → request bound to new student profile.
6. Staff scanning still blocked from the request CTA.

## Out of scope (explicit)

- Per-QR custom field schemas (the universal form stays single-source).
- Changes to messaging, scheduling, notifications, or RLS on support_requests.
- PWA/service-worker behavior.
