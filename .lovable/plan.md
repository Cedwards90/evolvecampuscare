
## Goal

Make QR codes (destination_type = `request`) open a clean, standalone support-request page with no app chrome. Guests verify by email (magic link), then submit. Once submitted, the request is attached to that student's account/folder and they see a confirmation screen with a "View status" link.

## What changes

### 1. New route: `/qr/:code/request`
Standalone, chrome-less page (no sidebar, no top nav). Renders the existing `SubmitRequest` wizard inside a minimal layout with just the Evolve logo + QR title/description banner.

### 2. QR landing routing (`/qr/:code`)
- If `destination_type = 'request'` and user IS signed in as a student → auto-redirect to `/qr/:code/request`.
- If `destination_type = 'request'` and user is NOT signed in → show only the email-verification card (magic link). No "Submit a Request / Schedule" chooser.
- If signed in as staff → keep existing "this is for students" message.
- `meeting` and `external` destinations: unchanged.

### 3. Magic-link return flow
Magic link redirects back to `/qr/:code?verified=1`. After Supabase auth completes, the QRLanding effect detects authenticated student + `destination_type='request'` and forwards to `/qr/:code/request`.

`handle_new_user` already creates the profile + student role + student_file for brand-new accounts, so the request will attach to the new student's folder automatically.

### 4. Standalone form page
- Reuses the existing `SubmitRequest` component (no business-logic changes).
- Wrapped in a new `QRStandaloneLayout` (logo, QR title/description banner, no nav).
- Reads `?qr=<code>` to prefill category from `qr_codes.prefill_category` (already supported).
- Logs `qr_scan_events` with `event_type='action_selected', action_kind='request'` and `event_type='request_submitted', target_id=<request.id>` (event types already exist).

### 5. Confirmation screen
After submit, instead of redirecting to `/requests/:id`, show a chrome-less success screen on `/qr/:code/request/success?id=<request_id>`:
- "Request submitted" headline
- Short ID and category
- Two buttons: **View status** → `/requests/:id` (auth-gated, lands them in app), and **Submit another** → back to the form.

### 6. Route registration
Add to `src/App.tsx` (public routes block, no `ProtectedRoute`):
- `/qr/:code/request` → `QRStandaloneRequest`
- `/qr/:code/request/success` → `QRRequestSuccess`

The form itself still requires an authenticated session to insert into `support_requests` (RLS), so the page guards: if no user, bounce back to `/qr/:code` to verify email first.

## Files touched

- `src/App.tsx` — add 2 public routes.
- `src/pages/QRLanding.tsx` — auto-redirect signed-in students to `/qr/:code/request` when destination is `request`; hide the chooser in that case.
- `src/pages/QRStandaloneRequest.tsx` — NEW. Chrome-less wrapper that renders `SubmitRequest` with a QR-aware success handler.
- `src/pages/QRRequestSuccess.tsx` — NEW. Confirmation screen.
- `src/pages/SubmitRequest.tsx` — small addition: accept an `onSubmitted(requestId)` prop (or detect `?qr=` and route to `/qr/:code/request/success`). No business-logic change.

## Out of scope

- Schema changes (none needed).
- Changes to `support_requests` RLS, assignment routing, notifications, or the wizard's business logic.
- The existing `/student/support-request` flow remains the primary in-app path.

## Backwards compatibility

- Existing `/qr/:code` URLs still work; `meeting` / `external` destinations behave exactly as today.
- No database migration.
- Old printed QR posters with `destination_type='request'` now go through the cleaner standalone flow automatically.
