

## Fix: Password Reset Fails for MFA-Enabled Accounts

### Problem
The auth logs show: **"AAL2 session is required to update email or password when MFA is enabled."** When the admin clicks the recovery link, Supabase creates an AAL1 session. But since the admin has MFA (TOTP) enrolled, `updateUser({ password })` requires AAL2. The reset password page doesn't prompt for a TOTP code before attempting the update.

### Solution
Add an MFA verification step to `ResetPassword.tsx`. After the recovery session is established, check if the user has MFA enrolled. If so, show a TOTP code input and verify it (elevating to AAL2) before allowing the password update.

### Changes

**`src/pages/ResetPassword.tsx`**
- After detecting the recovery session, check MFA factors via `supabase.auth.mfa.listFactors()`
- If verified TOTP factors exist, show a 6-digit code input before the password form
- Call `supabase.auth.mfa.challengeAndVerify()` to elevate to AAL2
- Only then allow `supabase.auth.updateUser({ password })`
- Flow: Recovery link → (if MFA) enter TOTP code → enter new password → done

| File | Change |
|------|--------|
| `src/pages/ResetPassword.tsx` | Add MFA verification step before password update |

