
-- ============================================================
-- program_cost_settings
-- ============================================================
CREATE TABLE public.program_cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  annual_program_cost numeric NOT NULL,
  cost_per_participant_override numeric NULL,
  avg_public_benefit_offset numeric NULL,
  currency text NOT NULL DEFAULT 'USD',
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_cost_settings TO authenticated;
GRANT ALL ON public.program_cost_settings TO service_role;

ALTER TABLE public.program_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all cost settings"
ON public.program_cost_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins manage own org cost settings"
ON public.program_cost_settings FOR ALL TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND organization_id IS NOT NULL
  AND public.is_org_admin_of(auth.uid(), organization_id)
  AND NOT public.is_org_suspended(organization_id)
)
WITH CHECK (
  public.is_org_admin(auth.uid())
  AND organization_id IS NOT NULL
  AND public.is_org_admin_of(auth.uid(), organization_id)
  AND NOT public.is_org_suspended(organization_id)
);

CREATE POLICY "Staff view cost settings"
ON public.program_cost_settings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'case_manager'::app_role)
  OR (
    public.is_org_admin(auth.uid())
    AND (organization_id IS NULL OR public.is_org_admin_of(auth.uid(), organization_id))
  )
);

CREATE TRIGGER program_cost_settings_updated_at
BEFORE UPDATE ON public.program_cost_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- participant_funnel_events
-- ============================================================
CREATE TABLE public.participant_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  qr_session_id uuid NULL,
  organization_id uuid NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_events_user ON public.participant_funnel_events(user_id);
CREATE INDEX idx_funnel_events_org ON public.participant_funnel_events(organization_id);
CREATE INDEX idx_funnel_events_type_created ON public.participant_funnel_events(event_type, created_at DESC);

GRANT SELECT, INSERT ON public.participant_funnel_events TO authenticated;
GRANT INSERT ON public.participant_funnel_events TO anon;
GRANT ALL ON public.participant_funnel_events TO service_role;

ALTER TABLE public.participant_funnel_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including pre-signup anon for qr_scan) can insert an event for themselves.
CREATE POLICY "Anyone can insert funnel events"
ON public.participant_funnel_events FOR INSERT TO anon, authenticated
WITH CHECK (
  -- authenticated users must tag with their own user_id (or leave null for anon-style events)
  user_id IS NULL OR user_id = auth.uid()
);

CREATE POLICY "Admins view all funnel events"
ON public.participant_funnel_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins view org funnel events"
ON public.participant_funnel_events FOR SELECT TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND organization_id IS NOT NULL
  AND public.is_org_admin_of(auth.uid(), organization_id)
);

CREATE POLICY "Users view own funnel events"
ON public.participant_funnel_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- Realtime
-- ============================================================
ALTER TABLE public.program_cost_settings REPLICA IDENTITY FULL;
ALTER TABLE public.participant_funnel_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_cost_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_funnel_events;
