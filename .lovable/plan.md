## Goal
Diagnose and gracefully handle the "rate limit exceeded" error on signup. Show clear, friendly messages with retry timing and prevent duplicate submissions — without weakening any security or auth defaults.

## Diagnosis

**Where the limit is enforced:** Supabase Auth applies built-in per-IP and per-email rate limits to `auth.signUp()` and the email-confirmation send it triggers. Defaults (visible in Cloud → Auth → Rate limits):
- Email send: ~2 per hour per address (free tier) — most common cause of "rate limit exceeded" on signup.
- Sign-up/sign-in: 30 per hour per IP.
- Token verification: 30 per 5 minutes.

The error surfaces to the client as a Supabase `AuthApiError` with message containing `"rate limit"` or `"For security purposes, you can only request this after N seconds"` (HTTP 429). Our current `onSignup` in `src/pages/Auth.tsx` only special-cases `"already registered"` and shows the raw message for everything else, which is why users see a bare "rate limit exceeded".

**Aggravating factors found in code review:**
- `signUp()` in `src/contexts/AuthContext.tsx` does not protect against duplicate clicks beyond the local `isSubmitting` flag. If a user double-clicks fast or the request hangs, multiple signups can fire and burn the per-email/IP quota.
- No client-side cooldown after a 429 — the user can keep clicking and re-trigger the same error.
- No surfacing of the `Retry-After` / "after N seconds" hint Supabase returns.

## Plan (frontend-only, no backend or auth-config changes)

### 1. Recognize and translate rate-limit errors
In `src/pages/Auth.tsx › onSignup`:
- Detect rate-limit errors by checking `error.message` for `rate limit`, `too many requests`, or the regex `/after (\d+) seconds?/i`, **or** `(error as any).status === 429`.
- Extract retry seconds from the message when present; otherwise default to 60s.
- Show a friendly toast: *"Too many signup attempts. Please wait {N} seconds and try again."*
- Apply the same translation to `onLogin` for consistency (sign-in shares the same limiter family) — only the message text changes; no logic changes.

### 2. Cooldown + duplicate-submit guard
- Add `signupCooldownUntil: number | null` state in `Auth.tsx`.
- When a 429 is detected, set it to `Date.now() + retrySeconds * 1000`.
- A small `useEffect` ticks every second to compute remaining seconds for display.
- The "Create Account" button is **disabled** while `isSubmitting` OR `cooldownRemaining > 0`, and its label switches to *"Try again in {N}s"*.
- An inline `Alert` above the form shows the cooldown reason and countdown so it's visible even if the toast was dismissed.
- Form submit handler short-circuits if cooldown is active (defense in depth against Enter key).

### 3. Prevent accidental double-submits
- Already have `isSubmitting`, but also disable the form's Submit on `mousedown` of the button (button already `type="submit"` + `disabled` — verify).
- Apply the same cooldown pattern to the **Login** form using a separate `loginCooldownUntil` (independent counters so a signup limit doesn't lock login).

### 4. Friendly mapping for common Supabase auth errors
Add a small `translateAuthError(error)` helper at the top of `Auth.tsx` (not exported / not shared yet — keep change small). Maps:
- `already registered` → existing message
- `rate limit` / 429 → cooldown message with seconds
- `Email rate limit exceeded` → *"Too many emails sent to this address recently. Please wait a few minutes before trying again."*
- `Invalid login credentials` → *"Email or password is incorrect."* (login only)
- Anything else → fall back to the original `error.message`.

### 5. UX feedback polish
- Toast variant `destructive` for errors (kept).
- Show the countdown in both the inline Alert and the button label.
- Once cooldown elapses, the alert auto-dismisses and the button re-enables.

## What we will NOT change (require explicit approval)
- Supabase Auth rate-limit configuration in Cloud (email, signup, token) — kept at current values.
- Email confirmation requirement (`auto_confirm_email`) — stays off.
- Password complexity, MFA flow, HIBP setting.
- `signUp()` in `AuthContext.tsx` (no signature change).
- Edge functions, DB schema, RLS.

## Files to edit
- `src/pages/Auth.tsx` — add `translateAuthError`, cooldown state for signup + login, inline alert, button label countdown, retry-after parsing.

## Out of scope
- Adding captcha / hCaptcha (requires user opt-in + key).
- Server-side rate limiting (per project rules — no backend rate limiting added).
- Raising Supabase rate limits (would need explicit approval and weakens protection).

## Verification after implementation
- Trigger signup with the same email 3× in a row → second attempt should show *"Too many emails sent…"* + a countdown, button disabled.
- Confirm normal happy-path signup still works (no behavior change when no error).
- Confirm login form's cooldown is independent.
