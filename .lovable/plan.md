# Fix the "email rate limit" on signup

## What's actually happening

The "email rate limit" message comes from the default Lovable Cloud email sender, which is capped at a small number of signups per hour. New users only fall back to that default sender when the project's own custom email pipeline can't accept the message.

On inspection, the project is in exactly that state:

- The custom sender domain `notify.evolvefoundation.us` is **verified and ready**.
- The custom `auth-email-hook` Edge Function is deployed and tries to enqueue every signup email into a managed queue.
- But the queue itself is **missing in the database**: there is no `email_send_log`, no `enqueue_email` function, and no `process-email-queue` cron job.

So every signup attempt fails inside the hook, the platform falls back to the default sender, and a few signups later everyone hits the shared rate limit.

## Plan

### 1. Re-provision the email queue infrastructure
Run the managed email infrastructure setup. This creates:
- `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`
- `enqueue_email` RPC and the `auth_emails` / `transactional_emails` queues
- The `process-email-queue` Edge Function and its 5-second cron job
- A vault secret so cron can authenticate

This is the actual fix — once it's in place, signup emails go out via `notify.evolvefoundation.us` instead of the rate-limited default sender.

### 2. Re-deploy the auth email hook
After the queue exists, redeploy `auth-email-hook` so it picks up a clean environment and we can verify it logs successful enqueues for new signups.

### 3. Temporary fallback: auto-confirm new signups
Per your choice, while step 1 propagates we'll flip auth to **auto-confirm email signups**. New users can sign in immediately without a verification email, which sidesteps the rate limit entirely until delivery is healthy.

### 4. Verify, then turn auto-confirm back off
After a real test signup we'll:
- Confirm a `sent` row appears in `email_send_log` for `template_name = 'signup'`.
- Confirm the email arrives from `noreply@evolvefoundation.us`.
- Then re-enable mandatory email verification (auto-confirm OFF) so the production flow returns to normal.

I'll let you know once step 4 is ready so you can decide when to flip verification back on.

## Out of scope
- No template/branding changes — current signup template is kept as-is.
- No third-party email service (Resend, SendGrid) — we stay on Lovable Emails since the domain is already delegated to Lovable's nameservers.
- No changes to MFA, social login, or invitation flows.
