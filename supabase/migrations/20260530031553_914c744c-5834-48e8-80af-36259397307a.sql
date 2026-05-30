
-- =========================================================
-- Participant Records Transfer & Continuity System
-- =========================================================

-- 1. participant_record_exports
CREATE TABLE public.participant_record_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'zip')),
  purpose TEXT NOT NULL DEFAULT 'handoff' CHECK (purpose IN ('handoff','audit','grant','transition','other')),
  notes TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  section_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_report JSONB NOT NULL DEFAULT '[]'::jsonb,
  transfer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prexports_student ON public.participant_record_exports(student_id, created_at DESC);
CREATE INDEX idx_prexports_transfer ON public.participant_record_exports(transfer_id);
CREATE INDEX idx_prexports_actor ON public.participant_record_exports(actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.participant_record_exports TO authenticated;
GRANT ALL ON public.participant_record_exports TO service_role;

ALTER TABLE public.participant_record_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff insert exports they perform"
  ON public.participant_record_exports FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Staff view exports in scope"
  ON public.participant_record_exports FOR SELECT TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id));

-- 2. participant_transfers
CREATE TABLE public.participant_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  from_organization_id UUID,
  to_organization_id UUID NOT NULL,
  initiated_by UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','cancelled','completed')),
  included_record_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  validation_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  acknowledgement_notes TEXT,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  export_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptransfers_student ON public.participant_transfers(student_id, created_at DESC);
CREATE INDEX idx_ptransfers_from_org ON public.participant_transfers(from_organization_id, status);
CREATE INDEX idx_ptransfers_to_org ON public.participant_transfers(to_organization_id, status);
CREATE INDEX idx_ptransfers_status ON public.participant_transfers(status, created_at DESC);

CREATE TRIGGER update_participant_transfers_updated_at
  BEFORE UPDATE ON public.participant_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.participant_transfers TO authenticated;
GRANT ALL ON public.participant_transfers TO service_role;

ALTER TABLE public.participant_transfers ENABLE ROW LEVEL SECURITY;

-- Admins (global)
CREATE POLICY "Admins manage all transfers"
  ON public.participant_transfers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Org Admins can read transfers they're either side of
CREATE POLICY "Org admins view their transfers"
  ON public.participant_transfers FOR SELECT TO authenticated
  USING (
    public.is_org_admin(auth.uid()) AND (
      (from_organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), from_organization_id))
      OR public.is_org_admin_of(auth.uid(), to_organization_id)
    )
  );

-- Org Admins can initiate transfers out of their org
CREATE POLICY "Org admins initiate transfers from their org"
  ON public.participant_transfers FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = auth.uid()
    AND public.is_org_admin(auth.uid())
    AND from_organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), from_organization_id)
    AND NOT public.is_org_suspended(from_organization_id)
  );

-- Org Admins of receiving org can acknowledge
CREATE POLICY "Receiving org admins acknowledge"
  ON public.participant_transfers FOR UPDATE TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.is_org_admin_of(auth.uid(), to_organization_id)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND public.is_org_admin_of(auth.uid(), to_organization_id)
  );

-- Assigned case managers can read transfers for their students (read-only)
CREATE POLICY "Case managers view transfers for assigned students"
  ON public.participant_transfers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'case_manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.student_assignments sa
      WHERE sa.case_manager_id = auth.uid() AND sa.student_id = participant_transfers.student_id
    )
  );

-- 3. participant_transfer_events
CREATE TABLE public.participant_transfer_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.participant_transfers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('initiated','record_added','record_removed','exported','acknowledged','cancelled','viewed','downloaded','note')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptevents_transfer ON public.participant_transfer_events(transfer_id, created_at);

GRANT SELECT, INSERT ON public.participant_transfer_events TO authenticated;
GRANT ALL ON public.participant_transfer_events TO service_role;

ALTER TABLE public.participant_transfer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert events on transfers I can see"
  ON public.participant_transfer_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.participant_transfers t
      WHERE t.id = participant_transfer_events.transfer_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (public.is_org_admin(auth.uid()) AND (
            (t.from_organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), t.from_organization_id))
            OR public.is_org_admin_of(auth.uid(), t.to_organization_id)
          ))
        )
    )
  );

CREATE POLICY "View events on transfers I can see"
  ON public.participant_transfer_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participant_transfers t
      WHERE t.id = participant_transfer_events.transfer_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (public.is_org_admin(auth.uid()) AND (
            (t.from_organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), t.from_organization_id))
            OR public.is_org_admin_of(auth.uid(), t.to_organization_id)
          ))
          OR (
            public.has_role(auth.uid(), 'case_manager'::app_role)
            AND EXISTS (
              SELECT 1 FROM public.student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = t.student_id
            )
          )
        )
    )
  );

-- 4. participant_record_access_log
CREATE TABLE public.participant_record_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_id UUID NOT NULL REFERENCES public.participant_record_exports(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('download','view_manifest')),
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pralog_export ON public.participant_record_access_log(export_id, created_at DESC);
CREATE INDEX idx_pralog_actor ON public.participant_record_access_log(actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.participant_record_access_log TO authenticated;
GRANT ALL ON public.participant_record_access_log TO service_role;

ALTER TABLE public.participant_record_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own access log on visible exports"
  ON public.participant_record_access_log FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.participant_record_exports e
      WHERE e.id = participant_record_access_log.export_id
        AND public.can_staff_manage_student(auth.uid(), e.student_id)
    )
  );

CREATE POLICY "View access log for visible exports"
  ON public.participant_record_access_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participant_record_exports e
      WHERE e.id = participant_record_access_log.export_id
        AND public.can_staff_manage_student(auth.uid(), e.student_id)
    )
  );

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('participant-exports', 'participant-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service role uploads, reads via signed URLs only.
-- Add read policy for staff that can manage the student matching {student_id}/...
CREATE POLICY "Staff read own-scope participant exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'participant-exports'
    AND public.can_staff_manage_student(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );
