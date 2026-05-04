# Fix: QR scan shows "Unavailable"

## Problem
The QR landing page (`/qr/:code`) queries `qr_codes` to look up the scanned code. The current SELECT RLS policy only allows `authenticated` users, so anyone scanning a QR code without already being signed in gets an empty result and sees the "QR Code Unavailable" error. Same issue blocks `qr_scan_events` inserts from anonymous scanners.

## Fix

### 1. RLS migration on `qr_codes`
Add a public SELECT policy limited to active codes and only the columns the landing page needs (already non-sensitive: id, code, label, org id, destination type/url, title, description, prefill_category, is_active).

```sql
CREATE POLICY "Anyone can view active qr codes"
ON public.qr_codes
FOR SELECT
TO anon, authenticated
USING (is_active = true);
```
Then drop the old `Authenticated users can view active qr codes` policy (now redundant). Admin/org-admin ALL policies remain unchanged.

### 2. RLS on `qr_scan_events`
Allow anonymous inserts so we still capture scan analytics before sign-in:

```sql
CREATE POLICY "Anyone can insert scan events"
ON public.qr_scan_events
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
```
(Replaces the existing authenticated-only insert policy.)

## Out of scope
- No changes to QR landing UI, routing, deletion, or admin pages.
- No new columns or data exposed beyond what the landing page already reads.
- Does not change auth flow — scanners still must sign in (magic link) to actually submit a request.

## Risk
Low. `qr_codes` rows contain no PII; `code` values are already shareable URLs. Inactive codes remain hidden.
