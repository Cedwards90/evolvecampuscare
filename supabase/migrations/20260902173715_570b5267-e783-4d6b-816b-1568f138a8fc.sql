-- ============================================================
-- PHASE 1: Data trust foundations
-- Non-destructive: existing rows are versioned, never removed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Versioning + coded answers on intake_responses
-- ------------------------------------------------------------
ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS intake_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS responses_coded jsonb,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_reason text;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id, section, intake_version
                            ORDER BY created_at, id) AS rn,
         count(*)     OVER (PARTITION BY student_id, section, intake_version) AS total
  FROM public.intake_responses
)
UPDATE public.intake_responses ir
SET attempt_number = r.rn,
    is_current = (r.rn = r.total),
    superseded_at = CASE WHEN r.rn < r.total THEN ir.updated_at ELSE NULL END
FROM ranked r
WHERE r.id = ir.id;

ALTER TABLE public.intake_responses
  ALTER COLUMN attempt_number SET DEFAULT 1,
  ALTER COLUMN attempt_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS intake_responses_attempt_uniq
  ON public.intake_responses (student_id, section, intake_version, attempt_number);

CREATE UNIQUE INDEX IF NOT EXISTS intake_responses_one_current
  ON public.intake_responses (student_id, section, intake_version)
  WHERE is_current;

-- ------------------------------------------------------------
-- 2. Versioning + coded answers on impact_survey_responses
-- ------------------------------------------------------------
ALTER TABLE public.impact_survey_responses
  ADD COLUMN IF NOT EXISTS survey_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS responses_coded jsonb,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_reason text;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id, template_id, survey_version
                            ORDER BY submitted_at, id) AS rn,
         count(*)     OVER (PARTITION BY student_id, template_id, survey_version) AS total
  FROM public.impact_survey_responses
)
UPDATE public.impact_survey_responses r0
SET attempt_number = r.rn,
    is_current = (r.rn = r.total),
    superseded_at = CASE WHEN r.rn < r.total THEN r0.submitted_at ELSE NULL END
FROM ranked r
WHERE r.id = r0.id;

ALTER TABLE public.impact_survey_responses
  ALTER COLUMN attempt_number SET DEFAULT 1,
  ALTER COLUMN attempt_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS impact_responses_attempt_uniq
  ON public.impact_survey_responses (student_id, template_id, survey_version, attempt_number);

CREATE UNIQUE INDEX IF NOT EXISTS impact_responses_one_current
  ON public.impact_survey_responses (student_id, template_id, survey_version)
  WHERE is_current;

-- ------------------------------------------------------------
-- 3. Versioning on post_graduation_plans
-- ------------------------------------------------------------
ALTER TABLE public.post_graduation_plans
  ADD COLUMN IF NOT EXISTS plan_version integer,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_reason text;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id ORDER BY created_at, id) AS rn,
         count(*)     OVER (PARTITION BY student_id) AS total
  FROM public.post_graduation_plans
)
UPDATE public.post_graduation_plans p
SET plan_version = r.rn,
    is_current = (r.rn = r.total),
    superseded_at = CASE WHEN r.rn < r.total THEN p.updated_at ELSE NULL END
FROM ranked r
WHERE r.id = p.id;

ALTER TABLE public.post_graduation_plans
  ALTER COLUMN plan_version SET DEFAULT 1,
  ALTER COLUMN plan_version SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS post_grad_plan_version_uniq
  ON public.post_graduation_plans (student_id, plan_version);

CREATE UNIQUE INDEX IF NOT EXISTS post_grad_plan_one_current
  ON public.post_graduation_plans (student_id)
  WHERE is_current;

-- ------------------------------------------------------------
-- 4. Versioning on career_intake_responses
-- ------------------------------------------------------------
ALTER TABLE public.career_intake_responses
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_reason text;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id ORDER BY created_at, id) AS rn,
         count(*)     OVER (PARTITION BY student_id) AS total
  FROM public.career_intake_responses
)
UPDATE public.career_intake_responses c
SET attempt_number = r.rn,
    is_current = (r.rn = r.total),
    superseded_at = CASE WHEN r.rn < r.total THEN c.updated_at ELSE NULL END
FROM ranked r
WHERE r.id = c.id;

ALTER TABLE public.career_intake_responses
  ALTER COLUMN attempt_number SET DEFAULT 1,
  ALTER COLUMN attempt_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS career_intake_attempt_uniq
  ON public.career_intake_responses (student_id, attempt_number);

CREATE UNIQUE INDEX IF NOT EXISTS career_intake_one_current
  ON public.career_intake_responses (student_id)
  WHERE is_current;

-- ------------------------------------------------------------
-- 5. survey_answer_codes: label -> stable code dictionary
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_answer_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_slug text NOT NULL,
  survey_version integer NOT NULL DEFAULT 1,
  question_id text NOT NULL,
  question_label text,
  answer_code text NOT NULL,
  answer_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  numeric_value numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT survey_answer_codes_code_fmt CHECK (answer_code ~ '^[a-z0-9_]{1,64}$'),
  CONSTRAINT survey_answer_codes_qid_fmt CHECK (question_id ~ '^[a-z0-9_]{1,64}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_answer_codes TO authenticated;
GRANT ALL ON public.survey_answer_codes TO service_role;

ALTER TABLE public.survey_answer_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read answer codes"
  ON public.survey_answer_codes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'case_manager'::app_role)
    OR public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins manage answer codes"
  ON public.survey_answer_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX IF NOT EXISTS survey_answer_codes_uniq
  ON public.survey_answer_codes (survey_slug, survey_version, question_id, answer_code);

CREATE UNIQUE INDEX IF NOT EXISTS survey_answer_codes_label_uniq
  ON public.survey_answer_codes (survey_slug, survey_version, question_id, lower(answer_label));

CREATE TRIGGER survey_answer_codes_updated_at
  BEFORE UPDATE ON public.survey_answer_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 6. data_quality_flags: unmappable / suspect values for review
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_row_id uuid,
  student_id uuid,
  organization_id uuid,
  flag_type text NOT NULL,
  question_id text,
  raw_value text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_quality_flags_type CHECK (
    flag_type IN ('unmapped_answer','out_of_range','missing_required','duplicate_suspect','inconsistent_dates','other')
  )
);

GRANT SELECT, INSERT, UPDATE ON public.data_quality_flags TO authenticated;
GRANT ALL ON public.data_quality_flags TO service_role;

ALTER TABLE public.data_quality_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view data quality flags"
  ON public.data_quality_flags FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (student_id IS NOT NULL AND public.can_staff_manage_student(auth.uid(), student_id))
    OR (student_id IS NULL AND public.is_org_admin(auth.uid()))
  );

CREATE POLICY "Staff create data quality flags"
  ON public.data_quality_flags FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'case_manager'::app_role)
    OR public.is_org_admin(auth.uid())
  );

CREATE POLICY "Staff resolve data quality flags"
  ON public.data_quality_flags FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (student_id IS NOT NULL AND public.can_staff_manage_student(auth.uid(), student_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (student_id IS NOT NULL AND public.can_staff_manage_student(auth.uid(), student_id))
  );

CREATE INDEX IF NOT EXISTS data_quality_flags_open_idx
  ON public.data_quality_flags (flag_type, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TRIGGER data_quality_flags_updated_at
  BEFORE UPDATE ON public.data_quality_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 7. Validation guards (triggers for time-dependent rules)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_profile_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
  END IF;
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := nullif(btrim(NEW.phone), '');
  END IF;
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth >= current_date THEN
    RAISE EXCEPTION 'Date of birth must be in the past';
  END IF;
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth < date '1900-01-01' THEN
    RAISE EXCEPTION 'Date of birth is not a plausible date';
  END IF;
  IF NEW.graduation_date IS NOT NULL AND NEW.cohort_start_date IS NOT NULL
     AND NEW.graduation_date < NEW.cohort_start_date THEN
    RAISE EXCEPTION 'Graduation date cannot be before the cohort start date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_row ON public.profiles;
CREATE TRIGGER trg_validate_profile_row
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_row();

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_amounts_nonneg,
  ADD CONSTRAINT support_requests_amounts_nonneg CHECK (
    (requested_amount IS NULL OR requested_amount >= 0)
    AND (approved_amount IS NULL OR approved_amount >= 0)
  );

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_text_limits,
  ADD CONSTRAINT support_requests_text_limits CHECK (
    char_length(title) BETWEEN 1 AND 200
    AND char_length(description) BETWEEN 1 AND 5000
    AND (funding_purpose IS NULL OR char_length(funding_purpose) <= 1000)
  );

ALTER TABLE public.file_notes
  DROP CONSTRAINT IF EXISTS file_notes_text_limits,
  ADD CONSTRAINT file_notes_text_limits CHECK (
    char_length(content) BETWEEN 1 AND 20000
    AND (title IS NULL OR char_length(title) <= 200)
  );

-- ------------------------------------------------------------
-- 8. Draft retention
-- ------------------------------------------------------------
ALTER TABLE public.form_drafts
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days');

CREATE OR REPLACE FUNCTION public.touch_form_draft_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := now() + interval '90 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_form_draft_expiry ON public.form_drafts;
CREATE TRIGGER trg_touch_form_draft_expiry
  BEFORE INSERT OR UPDATE ON public.form_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_form_draft_expiry();

CREATE INDEX IF NOT EXISTS form_drafts_expires_idx ON public.form_drafts (expires_at);

-- ------------------------------------------------------------
-- 9. Reporting indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS support_requests_created_idx ON public.support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS support_requests_cm_status_idx ON public.support_requests (assigned_case_manager_id, status);
CREATE INDEX IF NOT EXISTS support_requests_resolved_idx ON public.support_requests (resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_org_idx ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS profiles_cohort_idx ON public.profiles (cohort_id);
CREATE INDEX IF NOT EXISTS file_notes_student_created_idx ON public.file_notes (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_assignments_cm_idx ON public.student_assignments (case_manager_id);