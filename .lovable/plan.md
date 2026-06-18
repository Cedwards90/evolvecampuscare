# Allow Disabling MFA on Individual Accounts

Today MFA is mandatory for every staff member (admin / case_manager / org_admin). We'll add a per-user **MFA exemption** that an admin can toggle from User Management. Exempt users won't be forced to enroll or verify; everyone else stays mandatory.

## 1. Database

New nullable columns on `profiles`:
- `mfa_exempt boolean NOT NULL DEFAULT false`
- `mfa_exempt_reason text`
- `mfa_exempt_at timestamptz`
- `mfa_exempt_by uuid` (references the admin who set it)

Plus an audit table `mfa_exemption_audit` (user_id, actor_id, action `granted|revoked`, reason, created_at) with admin-only read and service-role writes.

RLS:
- Only admins can `UPDATE` the new columns on profiles (via a dedicated policy / edge function).
- Users can read their own `mfa_exempt` flag (already covered by existing self-select profile policy).

## 2. Edge function

New `set-user-mfa-exempt` function:
- Requires admin caller (AAL2 via existing `verifyMFAForPrivilegedRole`).
- Input: `{ userId, exempt: boolean, reason?: string }`.
- Updates the profile columns, writes audit row.
- Strict CORS + `sanitizeError`, same pattern as `set-user-active`.

## 3. Client enforcement

- Extend `useMFA` (or `AuthContext`) to fetch the caller's `mfa_exempt` flag.
- In `Auth.tsx` MFA gate: if `mfa_exempt === true`, skip both `showMFAEnrollment` and `showMFAVerification`, even for privileged roles.
- In `Settings.tsx` MFA section: when exempt, show a read-only "MFA waived by administrator" note (reason + date) instead of the enroll prompt. Users can still optionally enroll if they want.
- Server-side `verifyMFAForPrivilegedRole` (in `supabase/functions/_shared/security.ts`): short-circuit to `{ verified: true }` when the user's profile has `mfa_exempt = true`. This keeps edge functions consistent with the UI.

## 4. Admin UI

In `src/components/admin/UserManagement.tsx` user row menu, add:
- **"MFA: Required / Waived"** badge column (compact).
- Menu item **"Waive MFA…"** / **"Re-require MFA"** opening a dialog that collects an optional reason and calls the edge function. Confirmation required; toast on success.
- Admin-only; hidden for student rows (students never use MFA anyway).
- Invalidate `users-with-roles` query after change.

A new hook `useSetUserMfaExempt` wraps the function call (mirrors `useSetUserActive`).

## 5. Memory

Update `mem://technical/mfa-access-policy` to note: "Staff MFA is mandatory **unless** an admin has set `profiles.mfa_exempt = true` for that user; exemption is audited and surfaced in User Management."

## Out of scope
- No bulk waive UI (per-user only).
- No auto-expiring exemptions (admins manage manually).
- No change to student behavior (already MFA-disabled).
