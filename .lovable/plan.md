## Goal
Let admins (and org admins, for their org) delete QR codes from `/admin/qr-codes`.

## Changes

### `src/pages/admin/QRCodesPage.tsx`
- Add a **Delete** button (trash icon) next to the existing Edit/Toggle/Download actions in each QR row.
- Wrap it in an `AlertDialog` confirm: "Delete this QR code? Existing printed codes will stop working. Scan history will be retained."
- On confirm:
  - `supabase.from('qr_codes').delete().eq('id', row.id)`
  - Invalidate the `qr-codes` query and toast success.
  - Handle error toast.

### Database
- No schema changes. RLS already permits delete:
  - "Admins manage all qr codes" (ALL command)
  - "Org admins manage own org qr codes" (ALL, scoped to their org)
- `qr_scan_events.qr_code_id` has no FK constraint, so historical scan analytics remain intact after deletion.

## Out of scope
- No soft-delete / archive (hard delete only — matches the simple "delete" ask). The existing **Active toggle** already covers the soft-disable use case.
- No bulk delete.
- No changes to QR landing, RLS, or analytics.
