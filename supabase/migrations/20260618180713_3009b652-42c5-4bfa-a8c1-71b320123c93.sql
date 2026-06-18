-- 1) Junction table: case managers <-> cohorts
CREATE TABLE public.cohort_case_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  case_manager_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, case_manager_id)
);

CREATE INDEX cohort_case_managers_cohort_idx ON public.cohort_case_managers(cohort_id);
CREATE INDEX cohort_case_managers_cm_idx ON public.cohort_case_managers(case_manager_id);

GRANT SELECT, INSERT, DELETE ON public.cohort_case_managers TO authenticated;
GRANT ALL ON public.cohort_case_managers TO service_role;

ALTER TABLE public.cohort_case_managers ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY "Admins read all cohort CMs"
  ON public.cohort_case_managers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins read cohort CMs in scope"
  ON public.cohort_case_managers FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.id = cohort_case_managers.cohort_id
        AND public.is_org_admin_of(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY "Case managers read their own cohort links"
  ON public.cohort_case_managers FOR SELECT
  TO authenticated
  USING (case_manager_id = auth.uid());

CREATE POLICY "Students read CMs of their cohort"
  ON public.cohort_case_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.cohort_id = cohort_case_managers.cohort_id
    )
  );

-- INSERT policies
CREATE POLICY "Admins add cohort CMs"
  ON public.cohort_case_managers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins add cohort CMs in scope"
  ON public.cohort_case_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.id = cohort_case_managers.cohort_id
        AND public.is_org_admin_of(auth.uid(), c.organization_id)
    )
  );

-- DELETE policies
CREATE POLICY "Admins remove cohort CMs"
  ON public.cohort_case_managers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins remove cohort CMs in scope"
  ON public.cohort_case_managers FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.id = cohort_case_managers.cohort_id
        AND public.is_org_admin_of(auth.uid(), c.organization_id)
    )
  );

-- 2) When a CM is linked to a cohort, auto-create student_assignments for that cohort's students
CREATE OR REPLACE FUNCTION public.sync_cohort_case_manager_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
BEGIN
  FOR v_student IN
    SELECT user_id FROM public.profiles WHERE cohort_id = NEW.cohort_id
  LOOP
    INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
    VALUES (v_student, NEW.case_manager_id, COALESCE(NEW.assigned_by, auth.uid()), 'Auto-assigned via cohort')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cohort_cm_after_insert
AFTER INSERT ON public.cohort_case_managers
FOR EACH ROW EXECUTE FUNCTION public.sync_cohort_case_manager_assignments();

-- 3) When a student's cohort changes, auto-create student_assignments for that cohort's CMs
CREATE OR REPLACE FUNCTION public.sync_profile_cohort_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cm uuid;
BEGIN
  IF NEW.cohort_id IS NULL OR NEW.cohort_id IS NOT DISTINCT FROM OLD.cohort_id THEN
    RETURN NEW;
  END IF;
  FOR v_cm IN
    SELECT case_manager_id FROM public.cohort_case_managers WHERE cohort_id = NEW.cohort_id
  LOOP
    INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
    VALUES (NEW.user_id, v_cm, auth.uid(), 'Auto-assigned via cohort')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profile_cohort_after_update
AFTER UPDATE OF cohort_id ON public.profiles
FOR EACH ROW
WHEN (NEW.cohort_id IS DISTINCT FROM OLD.cohort_id)
EXECUTE FUNCTION public.sync_profile_cohort_assignments();
