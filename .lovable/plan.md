

## Plan: Hide MFA from Students Entirely

### Current State
- **Login flow (Auth.tsx):** MFA enrollment is already gated to `admin` and `case_manager` roles — students are never forced to enroll.
- **Settings page:** The "Two-Factor Authentication" section in the Security tab is visible to ALL users, including students. Students can optionally enable MFA.

### Change
Hide the entire MFA/Two-Factor Authentication card from students in Settings so they never see it.

### File Change

**`src/pages/Settings.tsx`**
- Wrap the "Two-Factor Authentication" card (the `<Card>` containing MFA status, enable/disable buttons, and enrolled devices) in a conditional: only render when `isPrivilegedRole` is true.
- This removes MFA visibility entirely for students while keeping it mandatory for admin/case_manager roles.

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Hide MFA card when user role is `student` |

Single-file, minimal change.

