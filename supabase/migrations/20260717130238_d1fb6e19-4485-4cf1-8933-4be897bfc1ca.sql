
-- 1. support_requests: financial fields
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS funding_purpose text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_requests_approval_status_chk'
  ) THEN
    ALTER TABLE public.support_requests
      ADD CONSTRAINT support_requests_approval_status_chk
      CHECK (approval_status IN ('pending','approved','partially_approved','denied'));
  END IF;
END $$;

-- 2. profiles: extended fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_first_name text,
  ADD COLUMN IF NOT EXISTS legal_last_name  text,
  ADD COLUMN IF NOT EXISTS preferred_name   text,
  ADD COLUMN IF NOT EXISTS date_of_birth    date,
  ADD COLUMN IF NOT EXISTS address_line1    text,
  ADD COLUMN IF NOT EXISTS address_line2    text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS state_region     text,
  ADD COLUMN IF NOT EXISTS postal_code      text,
  ADD COLUMN IF NOT EXISTS country          text,
  ADD COLUMN IF NOT EXISTS profile_last_reviewed_at timestamptz;

-- 3. profile_edit_audit
CREATE TABLE IF NOT EXISTS public.profile_edit_audit (
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

DROP POLICY IF EXISTS "Owner reads own audit" ON public.profile_edit_audit;
CREATE POLICY "Owner reads own audit" ON public.profile_edit_audit
  FOR SELECT TO authenticated
  USING (profile_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all audit" ON public.profile_edit_audit;
CREATE POLICY "Admins read all audit" ON public.profile_edit_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Org admins read scope" ON public.profile_edit_audit;
CREATE POLICY "Org admins read scope" ON public.profile_edit_audit
  FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope_v2(auth.uid(), profile_user_id));

DROP POLICY IF EXISTS "Case managers read assigned audit" ON public.profile_edit_audit;
CREATE POLICY "Case managers read assigned audit" ON public.profile_edit_audit
  FOR SELECT TO authenticated
  USING (public.cm_can_access_student(auth.uid(), profile_user_id));

CREATE INDEX IF NOT EXISTS idx_profile_edit_audit_user ON public.profile_edit_audit(profile_user_id, created_at DESC);

-- 4. trigger to capture profile edits
CREATE OR REPLACE FUNCTION public.log_profile_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fields text[] := ARRAY['full_name','preferred_name','legal_first_name','legal_last_name',
                          'email','phone','date_of_birth','address_line1','address_line2',
                          'city','state_region','postal_code','country'];
  f text;
  old_v text;
  new_v text;
BEGIN
  FOREACH f IN ARRAY fields LOOP
    old_v := to_jsonb(OLD)->>f;
    new_v := to_jsonb(NEW)->>f;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.profile_edit_audit(profile_user_id, actor_id, field, old_value, new_value)
      VALUES (NEW.user_id, auth.uid(), f, old_v, new_v);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_profile_edits ON public.profiles;
CREATE TRIGGER trg_log_profile_edits
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_edits();

-- 5. Case manager UPDATE policy on profiles for assigned students
DROP POLICY IF EXISTS "Case managers update assigned student profile" ON public.profiles;
CREATE POLICY "Case managers update assigned student profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.cm_can_access_student(auth.uid(), user_id))
WITH CHECK (public.cm_can_access_student(auth.uid(), user_id));
