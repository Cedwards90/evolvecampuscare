CREATE TABLE public.active_time_sessions (
  case_manager_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  student_id UUID,
  service_type service_type NOT NULL DEFAULT 'case_management',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_time_sessions TO authenticated;
GRANT ALL ON public.active_time_sessions TO service_role;

ALTER TABLE public.active_time_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CM manages own active session"
  ON public.active_time_sessions
  FOR ALL
  USING (case_manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (case_manager_id = auth.uid());

CREATE POLICY "Admins view active sessions"
  ON public.active_time_sessions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_org_admin(auth.uid()));

-- Allow admins to write MFA exemption audit rows (edge function uses service role anyway, but allow direct insert for admins)
CREATE POLICY "Admins insert MFA exemption audit"
  ON public.mfa_exemption_audit
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND actor_id = auth.uid());
