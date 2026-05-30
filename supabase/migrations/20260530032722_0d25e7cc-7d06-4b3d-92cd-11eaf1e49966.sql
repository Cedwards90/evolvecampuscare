-- Add account status columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_deactivated_at ON public.profiles(deactivated_at);

-- Helper: is_user_active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND deactivated_at IS NOT NULL
  );
$$;

-- Gate has_role with active status so all RLS based on has_role auto-revokes
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  ) AND public.is_user_active(_user_id)
$$;

-- Also gate is_org_admin so org admins lose powers when inactive
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'org_admin'
  ) AND public.is_user_active(_user_id)
$$;

-- Audit table
CREATE TABLE IF NOT EXISTS public.user_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('deactivated','reactivated')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_status_audit TO authenticated;
GRANT ALL ON public.user_status_audit TO service_role;

ALTER TABLE public.user_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all status audit"
  ON public.user_status_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins view status audit in scope"
  ON public.user_status_audit FOR SELECT
  TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), user_id));

CREATE INDEX IF NOT EXISTS idx_user_status_audit_user ON public.user_status_audit(user_id, created_at DESC);

-- Realtime
ALTER TABLE public.user_status_audit REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status_audit;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;