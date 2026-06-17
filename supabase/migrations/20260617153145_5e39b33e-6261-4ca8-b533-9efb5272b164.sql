-- Add MFA exemption columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_exempt_reason text,
  ADD COLUMN IF NOT EXISTS mfa_exempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_exempt_by uuid;

-- Audit table for MFA exemption changes
CREATE TABLE IF NOT EXISTS public.mfa_exemption_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('granted','revoked')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mfa_exemption_audit TO authenticated;
GRANT ALL ON public.mfa_exemption_audit TO service_role;

ALTER TABLE public.mfa_exemption_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read MFA exemption audit"
ON public.mfa_exemption_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages MFA exemption audit"
ON public.mfa_exemption_audit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);