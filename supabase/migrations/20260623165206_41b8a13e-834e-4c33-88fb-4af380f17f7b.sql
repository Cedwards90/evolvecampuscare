
-- 1. Triggers wiring up existing sync functions
DROP TRIGGER IF EXISTS trg_sync_profile_org_on_membership ON public.organization_memberships;
CREATE TRIGGER trg_sync_profile_org_on_membership
  AFTER INSERT OR UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_organization();

DROP TRIGGER IF EXISTS trg_sync_cohort_cm_to_students ON public.cohort_case_managers;
CREATE TRIGGER trg_sync_cohort_cm_to_students
  AFTER INSERT ON public.cohort_case_managers
  FOR EACH ROW EXECUTE FUNCTION public.sync_cohort_case_manager_assignments();

DROP TRIGGER IF EXISTS trg_sync_student_to_cohort_cms ON public.profiles;
CREATE TRIGGER trg_sync_student_to_cohort_cms
  AFTER UPDATE OF cohort_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.cohort_id IS DISTINCT FROM OLD.cohort_id)
  EXECUTE FUNCTION public.sync_profile_cohort_assignments();

-- 2. updated_at maintenance
DROP TRIGGER IF EXISTS trg_student_assignments_updated_at ON public.student_assignments;
CREATE TRIGGER trg_student_assignments_updated_at
  BEFORE UPDATE ON public.student_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add cohort tables to realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_case_managers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cohorts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 4. Ensure these tables emit full row data for realtime listeners
ALTER TABLE public.cohort_case_managers REPLICA IDENTITY FULL;
ALTER TABLE public.cohorts REPLICA IDENTITY FULL;
