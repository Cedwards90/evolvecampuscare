# QR Flow → Protected Student Support-Request Route

## Goal
QR scans land students on a protected `/student/support-request?source=qr` route. Auth is required first; after login, the student is returned to *their own* support-request page (scoped to their authenticated `auth.uid()`). Staff are blocked. QR usage stays tracked end-to-end and submitted requests sync everywhere via the realtime layer that already exists.

## Current state (verified)
- `/qr/:code` (`src/pages/QRLanding.tsx`) shows a picker, then routes the "Submit a Request" CTA to `/student-submitting-a-support-request`.
- That target route is already `<ProtectedRoute allowedRoles={['student']}>` → `SubmitRequest` page.
- `Auth.tsx` already honors `?redirect=…` after login/signup.
- QR usage is tracked via `useQRSession` (sessionStorage UUID + `qr_scan_events` insert) and `useSubmitRequest` already attaches `qr_session_id` to the new `support_requests` row and logs `action_completed`.
- Realtime sync for `support_requests` was just shipped, so any new request appears in CM/admin/reports views automatically.

## Plan (frontend only — no DB / business-logic changes)

### 1. Add the new protected route alias
`src/App.tsx`: register `/student/support-request` pointing at the existing `SubmitRequest` page, wrapped in `<ProtectedRoute allowedRoles={['student']}>`. Keeps the old URL working for bookmarks/back-compat.

### 2. Update QR landing CTA
`src/pages/QRLanding.tsx`:
- "Submit a Request" handler now targets `/student/support-request?source=qr`.
- For the not-logged-in branch, build the redirect as `/auth?redirect=${encodeURIComponent('/student/support-request?source=qr')}&remember=1` so the user lands on the new protected route after auth.
- Staff branch: instead of silently redirecting to `/dashboard`, show an inline access-denied message ("This page is for students only") with a "Go to dashboard" button. (Per your answer.)

### 3. Lock the page to the authenticated student
`src/pages/SubmitRequest.tsx` already uses `user.id` from `AuthContext` for the insert (verified via `useSubmitRequest`). Two small hardenings:
- Read `source` from `useSearchParams`; if `source === 'qr'` and no QR session exists in sessionStorage, log it and proceed normally (don't break flow, just won't attribute).
- Confirm the page never reads any `studentId` from URL — all writes use `user.id` only. (It already does; we'll add a code comment so this stays true.)

### 4. ProtectedRoute behavior
Verify `ProtectedRoute` preserves the original URL (including `?source=qr`) when redirecting to `/auth`. If it doesn't already, pass `redirect=${location.pathname + location.search}` so QR attribution survives the auth bounce.

### 5. QR tracking continuity
No schema changes. `startQRSession` is called on `/qr/:code` → sessionStorage holds it across the auth round-trip → `useSubmitRequest` reads `getQRSession()` and stamps `qr_session_id` on the new request → `clearQRSession()` after `action_completed` (already implemented). Confirmed end-to-end.

### 6. Sync to CM / admin / reports
Already covered by the realtime publication on `support_requests` shipped earlier this session — no new work. Submitted request appears immediately in:
- CM "My Requests" (filtered by `assigned_case_manager_id` via RLS + auto-assign on insert)
- Admin "All Requests" and unassigned alert
- Workload analytics / reports queries (invalidated by `useRealtimeRequests`)

## Out of scope (per your instruction)
- No edits to `useSubmitRequest`, RLS policies, schema, or any non-QR pages.
- No change to the "Schedule a Meeting" CTA target.
- No new tables; QR session tracking already lives in `qr_scan_events`.

## Verification
1. Log out. Open `/qr/<code>` → click "Submit a Request" → bounced to `/auth?redirect=/student/support-request%3Fsource%3Dqr` → log in → land on `/student/support-request?source=qr`.
2. Submit the form → row appears with `qr_session_id` set; `qr_scan_events` shows `scan → auth_required → auth_completed → action_selected → action_completed` with the same `session_id`.
3. CM dashboard updates instantly (realtime) without refresh.
4. Try `/student/support-request` as a case manager → access-denied (ProtectedRoute already enforces `allowedRoles`).
5. URL tampering: try injecting `?studentId=<other-uuid>` → ignored; insert uses `user.id` from auth context, RLS rejects mismatches.
