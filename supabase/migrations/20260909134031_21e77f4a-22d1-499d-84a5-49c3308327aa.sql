-- =========================================================
-- Internal controls framework
-- =========================================================

-- 1. support_requests: archive, payment, dual approval, confirmation, coding
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS second_approval_by uuid,
  ADD COLUMN IF NOT EXISTS second_approval_at timestamptz,
  ADD COLUMN IF NOT EXISTS participant_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS participant_confirmed_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS receipt_override_reason text,
  ADD COLUMN IF NOT EXISTS receipt_override_by uuid,
  ADD COLUMN IF NOT EXISTS funding_source_id uuid,
  ADD COLUMN IF NOT EXISTS cohort_id uuid,
  ADD COLUMN IF NOT EXISTS is_test_record boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_requests_archived_at ON public.support_requests(archived_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_paid_at ON public.support_requests(paid_at);

-- 2. request_updates: retract instead of delete
ALTER TABLE public.request_updates
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retracted_by uuid;

-- 3. Funding sources
CREATE TABLE IF NOT EXISTS public.funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funding_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.funding_sources TO authenticated;
GRANT ALL ON public.funding_sources TO service_role;
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read funding sources"
  ON public.funding_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage funding sources"
  ON public.funding_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER funding_sources_updated_at BEFORE UPDATE ON public.funding_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_funding_source_fk
  FOREIGN KEY (funding_source_id) REFERENCES public.funding_sources(id) ON DELETE SET NULL;

-- 4. Grant budget lines + category mapping
CREATE TABLE IF NOT EXISTS public.grant_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL,
  grant_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_budget_lines TO authenticated;
GRANT ALL ON public.grant_budget_lines TO service_role;
ALTER TABLE public.grant_budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read budget lines"
  ON public.grant_budget_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage budget lines"
  ON public.grant_budget_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER grant_budget_lines_updated_at BEFORE UPDATE ON public.grant_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.request_category_budget_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category request_category NOT NULL,
  funding_source_id uuid REFERENCES public.funding_sources(id) ON DELETE CASCADE,
  budget_line_id uuid NOT NULL REFERENCES public.grant_budget_lines(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rcbm_unique
  ON public.request_category_budget_map(category, COALESCE(funding_source_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_category_budget_map TO authenticated;
GRANT ALL ON public.request_category_budget_map TO service_role;
ALTER TABLE public.request_category_budget_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read budget mapping"
  ON public.request_category_budget_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage budget mapping"
  ON public.request_category_budget_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER rcbm_updated_at BEFORE UPDATE ON public.request_category_budget_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Controls settings (single row)
CREATE TABLE IF NOT EXISTS public.internal_controls_settings (
  id integer PRIMARY KEY DEFAULT 1,
  retention_months integer NOT NULL DEFAULT 84,
  designated_delete_admin_id uuid,
  second_approval_threshold numeric(12,2) NOT NULL DEFAULT 500,
  spending_last_reconciled_at timestamptz,
  spending_reconciled_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_controls_single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.internal_controls_settings TO authenticated;
GRANT ALL ON public.internal_controls_settings TO service_role;
ALTER TABLE public.internal_controls_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read controls settings"
  ON public.internal_controls_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update controls settings"
  ON public.internal_controls_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER ics_updated_at BEFORE UPDATE ON public.internal_controls_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.internal_controls_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 6. Permanent delete audit
CREATE TABLE IF NOT EXISTS public.request_delete_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  student_id uuid,
  actor_id uuid,
  reason text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.request_delete_audit TO authenticated;
GRANT ALL ON public.request_delete_audit TO service_role;
ALTER TABLE public.request_delete_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read delete audit"
  ON public.request_delete_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Monthly export log
CREATE TABLE IF NOT EXISTS public.retention_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  storage_path text,
  row_counts jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.retention_export_log TO authenticated;
GRANT ALL ON public.retention_export_log TO service_role;
ALTER TABLE public.retention_export_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read export log"
  ON public.retention_export_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write export log"
  ON public.retention_export_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 8. Separation-of-duties + documentation enforcement
CREATE OR REPLACE FUNCTION public.enforce_request_controls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold numeric;
BEGIN
  SELECT second_approval_threshold INTO v_threshold FROM public.internal_controls_settings WHERE id = 1;
  v_threshold := COALESCE(v_threshold, 500);

  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_amount IS NOT NULL AND NEW.requested_amount > 0
       AND COALESCE(btrim(NEW.funding_purpose), '') = '' THEN
      RAISE EXCEPTION 'Purpose of funds is required for financial requests';
    END IF;
    RETURN NEW;
  END IF;

  -- Second approver must differ from the first approver
  IF NEW.second_approval_by IS NOT NULL
     AND NEW.approval_decided_by IS NOT NULL
     AND NEW.second_approval_by = NEW.approval_decided_by THEN
    RAISE EXCEPTION 'The second approval must come from a different administrator';
  END IF;

  -- Payment recording rules
  IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL THEN
    IF NEW.paid_by IS NULL THEN
      RAISE EXCEPTION 'The person recording the payment must be identified';
    END IF;
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
      RAISE EXCEPTION 'A payment amount is required';
    END IF;
    IF NEW.approval_decided_by IS NULL THEN
      RAISE EXCEPTION 'A payment cannot be recorded before the request is approved';
    END IF;
    IF NEW.amount_paid > v_threshold AND NEW.second_approval_by IS NULL THEN
      RAISE EXCEPTION 'A second approval is required before paying more than %', v_threshold;
    END IF;
    IF NEW.paid_by = NEW.approval_decided_by
       OR (NEW.second_approval_by IS NOT NULL AND NEW.paid_by = NEW.second_approval_by) THEN
      RAISE EXCEPTION 'The person recording the payment cannot also be an approver';
    END IF;
  END IF;

  -- Resolution requires participant confirmation once money was paid
  IF NEW.status = 'resolved'::request_status AND OLD.status <> 'resolved'::request_status THEN
    IF NEW.paid_at IS NOT NULL
       AND NEW.participant_confirmed_at IS NULL
       AND COALESCE(btrim(NEW.receipt_override_reason), '') = '' THEN
      RAISE EXCEPTION 'The participant must confirm the amount received, or an administrator must record an override reason';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_request_controls ON public.support_requests;
CREATE TRIGGER trg_enforce_request_controls
  BEFORE INSERT OR UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_request_controls();

-- 9. Deletion blocked except for the designated administrator, always logged
CREATE OR REPLACE FUNCTION public.guard_request_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designated uuid;
  v_actor uuid := auth.uid();
BEGIN
  SELECT designated_delete_admin_id INTO v_designated FROM public.internal_controls_settings WHERE id = 1;

  IF v_actor IS NOT NULL THEN
    IF v_designated IS NULL OR v_actor <> v_designated THEN
      RAISE EXCEPTION 'Requests cannot be deleted. Archive the request instead.';
    END IF;
    IF COALESCE(btrim(OLD.archive_reason), '') = '' THEN
      RAISE EXCEPTION 'A recorded reason is required before deleting a request';
    END IF;
    INSERT INTO public.request_delete_audit (request_id, student_id, actor_id, reason, snapshot)
    VALUES (OLD.id, OLD.student_id, v_actor, OLD.archive_reason, to_jsonb(OLD));
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_request_delete ON public.support_requests;
CREATE TRIGGER trg_guard_request_delete
  BEFORE DELETE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_delete();

-- 10. Timeline entries can no longer be deleted by users; retraction only
CREATE OR REPLACE FUNCTION public.guard_request_update_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Activity entries cannot be deleted. Retract the entry instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_request_update_delete ON public.request_updates;
CREATE TRIGGER trg_guard_request_update_delete
  BEFORE DELETE ON public.request_updates
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_update_delete();

-- 11. Participants may confirm receipt on their own requests
DROP POLICY IF EXISTS "Students confirm receipt on own requests" ON public.support_requests;
CREATE POLICY "Students confirm receipt on own requests"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.enforce_request_controls() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_request_delete() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_request_update_delete() FROM anon, PUBLIC;