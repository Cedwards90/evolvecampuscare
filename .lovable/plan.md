# Plan: Financial Request Fields, Profile Editing, and Profile Review Prompt

Scope is limited to the three areas below. No changes to unrelated code.

## 1. Financial Assistance — expanded fields

Current state: `support_requests` already has `requested_amount` and `approved_amount`. The "Financial" category already conditionally shows the amount field in `SubmitRequest.tsx` and `EditRequestDialog.tsx`.

Additions:
- New columns on `support_requests`:
  - `funding_purpose text` — optional short reason (e.g., rent, books, transportation).
  - `approval_status text` — enum-like: `pending | approved | partially_approved | denied`, default `pending`.
  - `approval_decided_at timestamptz`, `approval_decided_by uuid` (references auth.users, set null on delete) — for audit.
- Validation:
  - Student form: if category = financial, `requested_amount` required, > 0, ≤ 1,000,000; `funding_purpose` optional but ≤ 200 chars.
  - Staff decision form: `approved_amount` required when status = approved/partially_approved; must be > 0 and ≤ `requested_amount`; denied clears approved_amount.
- Visibility & permissions:
  - Students see: their `requested_amount`, `funding_purpose`, `approval_status`, `approved_amount` (read-only after submission decision).
  - Students can edit `requested_amount` / `funding_purpose` only while status is `submitted` (existing edit gating) and only when approval_status is still `pending`.
  - Staff (admin, org_admin in scope, assigned case manager) can set `approval_status`, `approved_amount`, and record a decision note. Approve/deny actions handled in `RequestActions.tsx` behind a new "Funding decision" section (only rendered for financial category).
  - Non-financial categories: fields hidden everywhere.
- UI touchpoints (frontend only additions, no rewrites of unrelated logic):
  - `SubmitRequest.tsx`: add funding_purpose input under the amount field.
  - `EditRequestDialog.tsx`: add funding_purpose; disable amount/purpose once approval_status ≠ pending.
  - `RequestDetail.tsx`: new "Funding" panel showing purpose, requested vs approved, status badge.
  - `RequestActions.tsx`: staff-only decision controls (Approve / Partially approve / Deny with amount input and note).
  - `request-pdf.ts`: include new fields in PDF output.

## 2. Extended profile fields + admin/CM editing with audit log

Current profile columns include `full_name`, `email`, `phone`. Missing: preferred name, legal name split, date of birth, address.

Schema additions to `public.profiles`:
- `legal_first_name text`, `legal_last_name text`, `preferred_name text`
- `date_of_birth date`
- `address_line1 text`, `address_line2 text`, `city text`, `state_region text`, `postal_code text`, `country text`
- `profile_last_reviewed_at timestamptz` — student-confirmed review timestamp
- Keep existing `full_name` (derived/display); back-fill on first save from `legal_first_name + legal_last_name` when preferred_name is null.

Age handling: computed client-side and in a SQL view/derived selector from `date_of_birth` (no stored age column to avoid drift).

New audit table: `public.profile_edit_audit`
- `id uuid pk`, `profile_user_id uuid`, `actor_id uuid`, `field text`, `old_value text`, `new_value text`, `created_at timestamptz`
- RLS: admins can read all; org_admin can read for users in scope; the profile owner can read their own history. Only service_role writes (via trigger).
- Trigger on `profiles` UPDATE captures changes to the tracked fields (name/email/phone/dob/address) with `actor_id = auth.uid()`.

RLS updates:
- Add UPDATE policy allowing case managers to update assigned students' profiles (via `cm_can_access_student`) — limited to the extended field set through a security-definer function `update_student_profile_fields(...)` to enforce field-level allow-list. Admins and org_admins in scope already covered by existing/added policies.
- Email changes: only admin can change `profiles.email` directly; case managers cannot. Changing the auth-side email (`auth.users.email`) stays admin-only and is out of scope here — profile email edit updates the `profiles.email` display value only, with a warning that auth email is unchanged.

Frontend:
- New `EditProfileDialog` component reusable from `StudentDetail.tsx` (admin/org_admin/CM) and from Settings (self-edit).
- Field-level disable based on role.
- Show computed age next to DOB.
- History drawer showing audit rows.

## 3. Post-deploy profile review prompt for students

Trigger conditions (a student profile is "stale/incomplete" when any is true):
- `date_of_birth` null, OR
- `address_line1` null, OR
- `legal_first_name` null or `legal_last_name` null, OR
- `profile_last_reviewed_at` older than 180 days (or null after this deploy).

UX:
- New dismissible banner `ProfileReviewBanner` shown on `Dashboard` for students meeting the condition. Includes "Review profile" (opens the dialog) and "Remind me later" (sets a local `profile_review_snoozed_until` for 7 days in `localStorage` + a per-user `notifications`-style entry — no schema change; localStorage only to keep scope tight).
- If `date_of_birth` OR `legal_first_name/last_name` are missing (hard-required), banner is non-dismissible and links to a required flow reusing the same dialog with a "Save & continue" primary button.
- On successful save, set `profile_last_reviewed_at = now()`; banner disappears.

Realtime sync:
- `profiles` update already propagates via existing React Query invalidations. Add `queryClient.invalidateQueries` for: `['profile', userId]`, `['users-with-roles']`, `['student-detail', userId]`, `['requests']` (student name on cards), `['reports']` selectors that read profile display names. No new realtime channel needed — reuse existing `useRealtimeBridge` if it already subscribes to profiles; otherwise a targeted `postgres_changes` subscription on `profiles` filtered by `user_id` from `AuthContext`.

## Technical details

### Migration (single file)

```sql
-- support_requests: funding purpose + approval status
ALTER TABLE public.support_requests
  ADD COLUMN funding_purpose text,
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN approval_decided_at timestamptz,
  ADD COLUMN approval_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_approval_status_chk
  CHECK (approval_status IN ('pending','approved','partially_approved','denied'));

-- profiles: extended fields
ALTER TABLE public.profiles
  ADD COLUMN legal_first_name text,
  ADD COLUMN legal_last_name  text,
  ADD COLUMN preferred_name   text,
  ADD COLUMN date_of_birth    date,
  ADD COLUMN address_line1    text,
  ADD COLUMN address_line2    text,
  ADD COLUMN city             text,
  ADD COLUMN state_region     text,
  ADD COLUMN postal_code      text,
  ADD COLUMN country          text,
  ADD COLUMN profile_last_reviewed_at timestamptz;

-- audit log
CREATE TABLE public.profile_edit_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_edit_audit TO authenticated;
GRANT ALL   ON public.profile_edit_audit TO service_role;
ALTER TABLE public.profile_edit_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own audit"  ON public.profile_edit_audit FOR SELECT TO authenticated
  USING (profile_user_id = auth.uid());
CREATE POLICY "Admins read all audit"  ON public.profile_edit_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins read scope"  ON public.profile_edit_audit FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), profile_user_id));

-- trigger to capture profile edits
CREATE OR REPLACE FUNCTION public.log_profile_edits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fields text[] := ARRAY['full_name','preferred_name','legal_first_name','legal_last_name',
                                'email','phone','date_of_birth','address_line1','address_line2',
                                'city','state_region','postal_code','country'];
        f text;
BEGIN
  FOREACH f IN ARRAY fields LOOP
    IF to_jsonb(NEW)->>f IS DISTINCT FROM to_jsonb(OLD)->>f THEN
      INSERT INTO public.profile_edit_audit(profile_user_id, actor_id, field, old_value, new_value)
      VALUES (NEW.user_id, auth.uid(), f, to_jsonb(OLD)->>f, to_jsonb(NEW)->>f);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_profile_edits AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_edits();

-- case manager UPDATE policy for assigned students (field allow-list enforced app-side)
CREATE POLICY "Case managers update assigned student profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.cm_can_access_student(auth.uid(), user_id))
WITH CHECK (public.cm_can_access_student(auth.uid(), user_id));
```

### Frontend files touched (additions/edits only)

- New: `src/components/profile/EditProfileDialog.tsx`, `src/components/profile/ProfileReviewBanner.tsx`, `src/components/profile/ProfileAuditDrawer.tsx`, `src/hooks/useProfileEdit.ts`, `src/hooks/useProfileAudit.ts`, `src/lib/age.ts`.
- Edit: `SubmitRequest.tsx`, `EditRequestDialog.tsx`, `RequestDetail.tsx`, `RequestActions.tsx`, `Dashboard.tsx` (mount banner), `StudentDetail.tsx` (Edit button + audit drawer), `Settings.tsx` (self-edit), `types/database.ts`, `request-pdf.ts`.

### Out of scope
- Changing `auth.users.email` from the app (admin-only, separate flow).
- Historical backfill of `profile_last_reviewed_at` — leaving null triggers the banner intentionally.
- Any changes outside the three requested areas.
