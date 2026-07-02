
-- Weekly recurring availability for case managers / staff
CREATE TABLE public.case_manager_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 15 AND 240),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

GRANT SELECT ON public.case_manager_availability TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.case_manager_availability TO authenticated;
GRANT ALL ON public.case_manager_availability TO service_role;

ALTER TABLE public.case_manager_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read active availability"
  ON public.case_manager_availability FOR SELECT
  TO authenticated
  USING (is_active = true OR case_manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff manage own availability"
  ON public.case_manager_availability FOR ALL
  TO authenticated
  USING (case_manager_id = auth.uid())
  WITH CHECK (case_manager_id = auth.uid());

CREATE POLICY "Admins manage all availability"
  ON public.case_manager_availability FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins manage scoped availability"
  ON public.case_manager_availability FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), case_manager_id))
  WITH CHECK (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), case_manager_id));

CREATE TRIGGER update_case_manager_availability_updated_at
  BEFORE UPDATE ON public.case_manager_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cma_case_manager ON public.case_manager_availability(case_manager_id) WHERE is_active = true;

-- One-off blackout periods (vacation, out of office)
CREATE TABLE public.appointment_blackouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blackouts TO authenticated;
GRANT ALL ON public.appointment_blackouts TO service_role;

ALTER TABLE public.appointment_blackouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read blackouts"
  ON public.appointment_blackouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff manage own blackouts"
  ON public.appointment_blackouts FOR ALL
  TO authenticated
  USING (case_manager_id = auth.uid())
  WITH CHECK (case_manager_id = auth.uid());

CREATE POLICY "Admins manage all blackouts"
  ON public.appointment_blackouts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins manage scoped blackouts"
  ON public.appointment_blackouts FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), case_manager_id))
  WITH CHECK (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), case_manager_id));

CREATE TRIGGER update_appointment_blackouts_updated_at
  BEFORE UPDATE ON public.appointment_blackouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_blackouts_cm_range ON public.appointment_blackouts(case_manager_id, start_at, end_at);
