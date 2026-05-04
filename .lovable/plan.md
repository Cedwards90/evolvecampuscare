## Add "Continue with Google" to signup & login

Use Lovable Cloud's managed Google OAuth (no API keys needed; works on the published domain and previews).

### 1. Enable Google provider
- Call `supabase--configure_social_auth` with `providers: ["google"]` (do NOT disable email).
- This auto-generates `src/integrations/lovable/` and installs `@lovable.dev/cloud-auth-js`. Do not hand-edit those files.

### 2. UI changes — `src/pages/Auth.tsx` only
Add a `GoogleButton` rendered on **both** the Login and Signup tabs, above the email field, with a divider ("Or continue with email") between it and the existing form. No other components touched.

Behavior:
- Click → `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" + (inviteToken ? "?invite=" + inviteToken : "") })`.
- Loading state on the button (disables both Google + email submit while pending).
- Error → existing toast pattern (`variant: 'destructive'`).
- If `result.redirected` → return; browser handles redirect.
- Preserves the `?invite=...` token through the round-trip so `handle_invited_signup` still applies role/org/auto-assignment on first login.

### 3. Post-OAuth flow (no logic changes needed)
The existing `useEffect` in `Auth.tsx` already handles post-auth routing:
- `handle_new_user` trigger fires on first Google sign-in → creates profile, assigns default `student` role, creates `student_files`.
- `handle_invited_signup` fires too → if a pending invitation exists for that email, it overrides the role and applies org/case-manager assignment.
- The existing MFA gate (`isPrivilegedRole && !isEnrolled` → `setShowMFAEnrollment(true)`) still triggers for admin/case_manager Google sign-ins — staff MFA policy preserved.
- Student onboarding flow (profile completion → intake survey) is driven downstream by `Dashboard`/route guards and is unaffected.

### 4. Account linking by email
Supabase auth links a Google identity to an existing email/password user automatically **only if the Google email is verified** (which it always is). No custom code needed. We will note this in the Google button's helper text: "Uses your verified Google email — links to your existing account if one exists."

### 5. Out of scope (will not change)
- `AuthContext`, `useMFA`, profile/role triggers, dashboard routing, invitation logic, password reset.
- Email/password signup remains the default and fully functional.
- No changes to `supabase/config.toml` beyond what `configure_social_auth` writes.

### Technical notes
- Import: `import { lovable } from "@/integrations/lovable";`
- The Google button is a small inline component inside `Auth.tsx` (no new files) to keep the change scoped.
- Uses brand-aligned styling: pill-shaped (`rounded-full`), outline variant, official Google "G" SVG icon.

### Verification
1. Fresh Google account → lands on dashboard as `student`, profile + student_file created.
2. Existing email/password user signs in with same-email Google → same `user_id`, no duplicate profile.
3. Invited admin signs up via Google with `?invite=...` → role becomes `admin`, MFA enrollment screen appears.
4. Email/password login still works unchanged.
