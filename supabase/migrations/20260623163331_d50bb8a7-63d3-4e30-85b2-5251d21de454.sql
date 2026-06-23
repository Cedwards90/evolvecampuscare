ALTER TABLE public.impact_survey_assignments
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_impact_survey_assignments_cohort
  ON public.impact_survey_assignments(cohort_id) WHERE cohort_id IS NOT NULL;