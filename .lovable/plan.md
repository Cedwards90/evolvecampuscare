# Share Support Request as PDF

Add a staff-only "Share as PDF" feature on each support request with download, email, and tokenized secure link options. Includes audit logging and link expiration.

## Scope

- Add **Share as PDF** button on the request detail page, visible only to Admin / Case Manager / Org Admin (subject to existing access).
- PDF includes the **full** request details (staff-only mode):
  - Title, description, category, priority, status
  - Student name, email, organization
  - Assigned case manager
  - Monetary fields (requested/approved amounts)
  - Timestamps (created, updated, resolved, escalated)
  - Full timeline (including internal notes)
  - Attachment filenames (no file contents)
- Three sharing actions in a single dialog:
  1. **Download PDF** — generated server-side, returned as a download.
  2. **Email PDF** — sends via existing Lovable email infrastructure to one or more recipients.
  3. **Secure link** — tokenized public URL with expiration (1h / 24h / 7d / 30d), revocable.
- All actions are **audit-logged** (who, when, action, recipients, IP, user-agent).
- Secure link uses **token-only** access (anyone with the link can view until expiration or revocation).

## User Flow

1. Staff opens a request → clicks **Share as PDF** in the actions area.
2. Dialog opens with three tabs: Download / Email / Secure Link.
3. **Download** — clicks button → PDF streams down.
4. **Email** — enters recipient email(s) + optional message → sends.
5. **Secure Link** — picks expiration → generates link, copy-to-clipboard. Existing links shown with status (active/expired/revoked) and a revoke button.
6. External recipient opens link → lightweight public page that streams the PDF (no app login).

## Technical Section

### Database (new migration)

- `request_share_links`
  - `id`, `request_id`, `token` (unguessable, 32-byte base64url, unique, indexed)
  - `created_by`, `created_at`, `expires_at`, `revoked_at`
  - `last_accessed_at`, `access_count`
- `request_share_audit`
  - `id`, `request_id`, `actor_id`, `action` (`download` | `email` | `link_created` | `link_revoked` | `link_accessed`)
  - `recipients` (text[] for email), `share_link_id` (nullable)
  - `ip`, `user_agent`, `created_at`

RLS:
- `request_share_links` and `request_share_audit`: SELECT/INSERT for staff (admin / case_manager assigned to request / org_admin in scope). Reuses existing `has_role` and `user_in_org_admin_scope` helpers.
- Public access happens through Edge Function only (service-role); tables remain locked down.

### Edge Functions (new, all under `supabase/functions/`)

1. **`generate-request-pdf`** (auth required)
   - Validates caller has staff access to the `request_id` (via `auth.getUser()` + RLS read attempt).
   - Builds PDF using `pdf-lib` (Deno-compatible) with brand colors (Forest Green / Sage), logo header, and structured sections.
   - Returns `application/pdf` stream. Logs `download` to audit.

2. **`share-request-pdf`** (auth required)
   - Body: `{ request_id, mode: 'email' | 'create_link' | 'revoke_link', recipients?, expires_in_hours?, link_id? }`.
   - For `email`: generates PDF in-memory, sends via existing transactional email path with PDF attachment (one recipient per send), logs `email`.
   - For `create_link`: inserts row into `request_share_links` with crypto-random token; returns full URL. Logs `link_created`.
   - For `revoke_link`: sets `revoked_at`. Logs `link_revoked`.
   - Strict CORS, Zod validation, `sanitizeError` (matches existing edge function security memory).

3. **`public-request-pdf`** (public, `verify_jwt = false`)
   - Path: `/?token=...`.
   - Looks up token (service-role); rejects if missing, revoked, or expired.
   - Increments `access_count` / `last_accessed_at`. Logs `link_accessed` with IP/UA.
   - Streams PDF (same generator as #1 but called internally).

### Frontend (only new files, plus a single tightly-scoped addition to the request detail page)

New files:
- `src/components/requests/SharePdfDialog.tsx` — tabbed dialog (Download / Email / Secure Link).
- `src/components/requests/ShareLinksList.tsx` — table of existing links inside the dialog with revoke button + copy.
- `src/hooks/useRequestSharing.ts` — wraps the three Edge Function calls + react-query.
- `src/pages/PublicSharedRequest.tsx` — minimal mobile-friendly page shown when opening a secure link; embeds the PDF.

Minimal additions to existing files (no behavioral changes elsewhere):
- `src/pages/RequestDetail.tsx` — add **Share as PDF** button (staff-only) that opens `SharePdfDialog`.
- `src/App.tsx` — add public route `/shared/request/:token` → `PublicSharedRequest`.

### Security & privacy

- Generation always re-checks access server-side. Frontend role check is UX only.
- Tokens: 256-bit, base64url, unique index. Default expiration: **24h**. Max: **30d**.
- Public page sets `X-Robots-Tag: noindex` and a Content-Security-Policy that disallows external embeds.
- Audit table is append-only; no UPDATE/DELETE policies for end users.
- Email sends use the existing transactional infrastructure (no new provider).
- No changes to existing RLS policies on `support_requests`, profiles, or related tables.

### Out of scope

- Editing existing request, attachment, or notification logic.
- Recipient identity verification (no OTP gating — by your choice "Token-only").
- Bulk export (per-request only).
- Storing generated PDFs in Storage (generated on demand each time).
