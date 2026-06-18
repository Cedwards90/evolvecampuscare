
-- Enums
CREATE TYPE public.time_entry_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.service_type AS ENUM ('direct_service', 'case_management', 'documentation', 'meeting', 'outreach', 'travel', 'other');

-- time_entries table
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_manager_id uuid NOT NULL,
  student_id uuid NULL,
  organization_id uuid NULL,
  entry_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 0,
  service_type public.service_type NOT NULL DEFAULT 'case_management',
  notes text NULL,
  billable boolean NOT NULL DEFAULT true,
  status public.time_entry_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  review_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_cm_date ON public.time_entries(case_manager_id, entry_date DESC);
CREATE INDEX idx_time_entries_student ON public.time_entries(student_id);
CREATE INDEX idx_time_entries_org ON public.time_entries(organization_id);
CREATE INDEX idx_time_entries_status ON public.time_entries(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Audit table
CREATE TABLE public.time_entry_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL, -- created | updated | approved | rejected | deleted
  diff jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entry_audit_entry ON public.time_entry_audit(time_entry_id);

GRANT SELECT, INSERT ON public.time_entry_audit TO authenticated;
GRANT ALL ON public.time_entry_audit TO service_role;

ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;

-- Validation + bookkeeping trigger
CREATE OR REPLACE FUNCTION public.validate_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_actor boolean;
  is_org_admin_actor boolean;
  resolved_org uuid;
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  IF NEW.entry_date > current_date THEN
    RAISE EXCEPTION 'Entry date cannot be in the future';
  END IF;

  -- Compute duration (minutes)
  NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::int / 60;

  -- Auto-fill organization_id if missing
  IF NEW.organization_id IS NULL THEN
    IF NEW.student_id IS NOT NULL THEN
      SELECT organization_id INTO resolved_org FROM public.profiles WHERE user_id = NEW.student_id;
    END IF;
    IF resolved_org IS NULL THEN
      SELECT organization_id INTO resolved_org FROM public.profiles WHERE user_id = NEW.case_manager_id;
    END IF;
    NEW.organization_id := resolved_org;
  END IF;

  -- Status change gating
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    is_admin_actor := public.has_role(auth.uid(), 'admin'::app_role);
    is_org_admin_actor := public.is_org_admin(auth.uid());
    IF NOT (is_admin_actor OR is_org_admin_actor) THEN
      RAISE EXCEPTION 'Only admins or org admins can change entry status';
    END IF;
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_time_entry
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := to_jsonb(NEW);
    INSERT INTO public.time_entry_audit(time_entry_id, actor_id, action, diff)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.case_manager_id), v_action, v_diff);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := NEW.status::text;
    ELSE
      v_action := 'updated';
    END IF;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    INSERT INTO public.time_entry_audit(time_entry_id, actor_id, action, diff)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.case_manager_id), v_action, v_diff);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_audit(time_entry_id, actor_id, action, diff)
    VALUES (OLD.id, COALESCE(auth.uid(), OLD.case_manager_id), 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_time_entry
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.audit_time_entry();

-- Org scope helper for time entries (covers both case manager and student org membership)
CREATE OR REPLACE FUNCTION public.org_admin_can_access_time_entry(_actor uuid, _entry_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.time_entries te
    WHERE te.id = _entry_id
      AND public.is_org_admin(_actor)
      AND (
        public.user_in_org_admin_scope_v2(_actor, te.case_manager_id)
        OR (te.student_id IS NOT NULL AND public.user_in_org_admin_scope_v2(_actor, te.student_id))
        OR (te.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.org_admins oa
              WHERE oa.user_id = _actor AND oa.organization_id = te.organization_id
        ))
      )
  );
$$;

-- RLS policies: time_entries
CREATE POLICY "CM sees own entries" ON public.time_entries
FOR SELECT TO authenticated
USING (
  case_manager_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.org_admin_can_access_time_entry(auth.uid(), id)
);

CREATE POLICY "CM inserts own entries" ON public.time_entries
FOR INSERT TO authenticated
WITH CHECK (
  case_manager_id = auth.uid()
  AND (public.has_role(auth.uid(), 'case_manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "CM updates own pending entries" ON public.time_entries
FOR UPDATE TO authenticated
USING (
  (case_manager_id = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.org_admin_can_access_time_entry(auth.uid(), id)
)
WITH CHECK (
  (case_manager_id = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.org_admin_can_access_time_entry(auth.uid(), id)
);

CREATE POLICY "CM deletes own pending entries" ON public.time_entries
FOR DELETE TO authenticated
USING (
  (case_manager_id = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS policies: audit (read-only for admins and the entry owner)
CREATE POLICY "Audit visibility" ON public.time_entry_audit
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR actor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.time_entries te
    WHERE te.id = time_entry_audit.time_entry_id
      AND (te.case_manager_id = auth.uid()
           OR public.org_admin_can_access_time_entry(auth.uid(), te.id))
  )
);

CREATE POLICY "Audit inserts by system" ON public.time_entry_audit
FOR INSERT TO authenticated
WITH CHECK (true);
