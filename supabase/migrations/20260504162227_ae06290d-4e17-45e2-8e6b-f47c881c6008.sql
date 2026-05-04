
-- QR codes table
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  organization_id uuid REFERENCES public.training_organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_codes_org ON public.qr_codes(organization_id);
CREATE INDEX idx_qr_codes_code ON public.qr_codes(code);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all qr codes"
  ON public.qr_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins manage own org qr codes"
  ON public.qr_codes FOR ALL TO authenticated
  USING (is_org_admin(auth.uid()) AND organization_id IS NOT NULL AND is_org_admin_of(auth.uid(), organization_id))
  WITH CHECK (is_org_admin(auth.uid()) AND organization_id IS NOT NULL AND is_org_admin_of(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can view active qr codes"
  ON public.qr_codes FOR SELECT TO authenticated
  USING (is_active = true);

-- Event type enum
CREATE TYPE public.qr_event_type AS ENUM (
  'scan','auth_required','auth_completed','action_selected','action_started','action_completed'
);

CREATE TYPE public.qr_action_kind AS ENUM ('request','meeting');

-- Scan events
CREATE TABLE public.qr_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  user_id uuid,
  event_type public.qr_event_type NOT NULL,
  action_kind public.qr_action_kind,
  target_id uuid,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_events_code_time ON public.qr_scan_events(qr_code_id, created_at DESC);
CREATE INDEX idx_qr_events_session ON public.qr_scan_events(session_id);
CREATE INDEX idx_qr_events_user ON public.qr_scan_events(user_id);

ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert events (they are funnel events for an active code).
-- We require event rows to either match the current user or be unauthenticated (user_id NULL).
CREATE POLICY "Users can insert their own scan events"
  ON public.qr_scan_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can view their own scan events"
  ON public.qr_scan_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all scan events"
  ON public.qr_scan_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins view scan events for their codes"
  ON public.qr_scan_events FOR SELECT TO authenticated
  USING (
    is_org_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.qr_codes qc
      WHERE qc.id = qr_scan_events.qr_code_id
        AND qc.organization_id IS NOT NULL
        AND is_org_admin_of(auth.uid(), qc.organization_id)
    )
  );

-- Tagging columns on existing tables
ALTER TABLE public.support_requests ADD COLUMN qr_session_id uuid;
ALTER TABLE public.appointments ADD COLUMN qr_session_id uuid;

CREATE INDEX idx_support_requests_qr_session ON public.support_requests(qr_session_id) WHERE qr_session_id IS NOT NULL;
CREATE INDEX idx_appointments_qr_session ON public.appointments(qr_session_id) WHERE qr_session_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER update_qr_codes_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
