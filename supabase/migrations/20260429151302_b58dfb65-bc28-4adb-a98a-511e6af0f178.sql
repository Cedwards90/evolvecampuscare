
-- Bulk invite jobs tracking
CREATE TABLE public.bulk_invite_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  notes text,
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.bulk_invite_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.bulk_invite_jobs(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  invitation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bulk_invite_job_items_job ON public.bulk_invite_job_items(job_id);

ALTER TABLE public.bulk_invite_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_invite_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bulk invite jobs"
  ON public.bulk_invite_jobs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage bulk invite job items"
  ON public.bulk_invite_job_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Scheduled survey distributions
CREATE TABLE public.scheduled_survey_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  survey_type text NOT NULL,
  recipient_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_scheduled_surveys_status_time ON public.scheduled_survey_distributions(status, scheduled_for);

ALTER TABLE public.scheduled_survey_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all scheduled distributions"
  ON public.scheduled_survey_distributions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators view their scheduled distributions"
  ON public.scheduled_survey_distributions FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Staff create scheduled distributions"
  ON public.scheduled_survey_distributions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'case_manager'::app_role))
  );

CREATE POLICY "Creators cancel their scheduled distributions"
  ON public.scheduled_survey_distributions FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
