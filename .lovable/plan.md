## Mandatory NDA Acceptance Gate

A full-page NDA step that every user — new signups, invited users, and existing users on next login — must accept before reaching any other part of the app. Acceptance is versioned and audited (version, IP, user agent, timestamp). When you publish a new NDA version, every user is forced to re-accept on their next session.

> **Important caveat (be aware):** An NDA on signup is a meaningful legal deterrent and gives you a clear cause of action against people who copy the app, but it cannot technically prevent someone from screenshotting screens or rebuilding similar functionality from memory. The published frontend JavaScript is also inherently visible to any logged-in user's browser. The NDA is the right tool for legal protection; pair it with Terms of Service and copyright notices for full coverage.

### What gets built

**1. Database (new tables + setting)**
- `nda_documents` — stores each version of the NDA (`version`, `title`, `body_markdown`, `effective_at`, `is_current`, `created_by`). Only one row has `is_current = true`.
- `nda_acceptances` — audit log: `user_id`, `nda_document_id`, `version`, `accepted_at`, `ip_address`, `user_agent`. Unique on `(user_id, nda_document_id)` so a user accepts each version exactly once.
- RLS: users can read the current NDA + their own acceptances and insert their own acceptance. Admins can manage `nda_documents` and view all acceptances.
- Seed v1 with the generated NDA text (see below).

**2. Generated NDA template (v1)**
A comprehensive NDA covering:
- Definition of Confidential Information (UI, workflows, data models, code, screenshots, documentation, business logic)
- Non-disclosure & non-use obligations
- **No copying, reverse engineering, decompiling, scraping, or recreating** the app, in whole or in part
- **No derivative works** or substantially similar products
- IP ownership remains with Evolve Foundation
- Permitted use limited to the user's authorized role
- Term: perpetual for confidentiality, survives account termination
- Remedies: injunctive relief + damages
- Governing law placeholder (you'll fill in jurisdiction)
- Contact for breach reports

You'll be able to review/edit the seeded text before approval.

**3. Frontend gate (`/accept-nda` full-page step)**
- After login (and after signup), `ProtectedRoute` checks if the user has accepted the **current** NDA version. If not → hard redirect to `/accept-nda`.
- Page shows: NDA title, version, effective date, full scrollable text.
- **Accept button is disabled until the user scrolls to the bottom** of the document.
- Checkbox: "I have read and agree to the Non-Disclosure Agreement."
- On accept: insert into `nda_acceptances` with version, IP (captured server-side via Edge Function), user agent, then route to original destination.
- Decline button → signs the user out with a message ("You must accept the NDA to use this platform").

**4. Edge Function: `record-nda-acceptance`**
Captures real client IP from request headers (the browser cannot reliably report its own IP) and inserts the acceptance row server-side. Returns success to the client.

**5. Admin UI: `/admin/nda` (new page in admin nav)**
- View current NDA + full version history
- "Publish new version" — opens editor with markdown field, sets `is_current = true` on save and demotes the previous version (which forces all users to re-accept on next login)
- Acceptance log table: user, email, version accepted, timestamp, IP, user agent — with CSV export
- Search/filter by user or version

**6. Existing users**
No data migration needed. Because no one has a row in `nda_acceptances` for v1 yet, every existing user — including admins — will be redirected to `/accept-nda` on their next page load.

### Technical details

- Tables created via migration with proper RLS; `nda_documents` enforces single-current via partial unique index `WHERE is_current = true`.
- `useCurrentNda()` and `useNdaAcceptance()` React Query hooks for the gate check.
- Gate check runs in `ProtectedRoute` after auth/MFA checks but before profile-completion/intake-survey checks, so NDA is the very first thing users see post-login.
- IP captured from `x-forwarded-for` / `cf-connecting-ip` in the Edge Function (sanitized, first hop only).
- Excluded routes from the gate: `/auth`, `/accept-nda`, `/forgot-password`, `/reset-password`, public QR landing pages, public shared request links.
- Brand-aligned: Forest Green primary, pill-shaped buttons, Evolve Foundation logo at top of the NDA page.

### Out of scope (can add later if you want)
- Editable-by-admin NDA WYSIWYG (the admin UI here uses markdown — simpler and safer).
- Per-role NDAs (one NDA applies to all roles for v1).
- Email notification when a new NDA version is published.
