

## Plan: Forgot Password Flow

### Overview
Add a complete forgot password flow: a "Forgot Password?" link on the login form, a password reset request form, and a `/reset-password` page where users set a new password after clicking the email link.

### Changes

#### 1. Add "Forgot Password?" Link to Login Form
**File:** `src/pages/Auth.tsx`
- Add a "Forgot Password?" link below the password field in the login tab
- Clicking it navigates to `/forgot-password`

#### 2. Create Forgot Password Page
**File:** `src/pages/ForgotPassword.tsx` (new)
- Simple form with email input wrapped in `AuthLayout`
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Shows success message: "Check your email for a password reset link"
- Link back to sign in

#### 3. Create Reset Password Page
**File:** `src/pages/ResetPassword.tsx` (new)
- Public route using `AuthLayout`
- On mount, detects `type=recovery` from the URL hash (Supabase redirects with this)
- Shows new password + confirm password form with the same strength requirements as signup
- Calls `supabase.auth.updateUser({ password })` to set the new password
- On success, shows confirmation and redirects to `/auth`

#### 4. Add Routes
**File:** `src/App.tsx`
- Add `/forgot-password` route (public) → `ForgotPassword`
- Add `/reset-password` route (public) → `ResetPassword`

### File Summary

| File | Action |
|------|--------|
| `src/pages/Auth.tsx` | Add "Forgot Password?" link |
| `src/pages/ForgotPassword.tsx` | Create |
| `src/pages/ResetPassword.tsx` | Create |
| `src/App.tsx` | Add 2 public routes |

