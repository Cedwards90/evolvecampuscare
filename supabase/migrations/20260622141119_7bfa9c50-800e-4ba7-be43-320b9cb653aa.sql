
-- 1. Personality profiles
CREATE TABLE public.student_personality_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  type_code text,
  type_name text,
  energy_pct int,
  energy_label text,
  mind_pct int,
  mind_label text,
  nature_pct int,
  nature_label text,
  tactics_pct int,
  tactics_label text,
  identity_pct int,
  identity_label text,
  strengths text[] NOT NULL DEFAULT '{}',
  weaknesses text[] NOT NULL DEFAULT '{}',
  summary text,
  assessment_source text,
  assessment_url text,
  assessed_on date,
  attachment_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_personality_profiles TO authenticated;
GRANT ALL ON public.student_personality_profiles TO service_role;

ALTER TABLE public.student_personality_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage personality profiles"
  ON public.student_personality_profiles FOR ALL TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id))
  WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Students can view own personality profile"
  ON public.student_personality_profiles FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER trg_personality_profiles_updated
  BEFORE UPDATE ON public.student_personality_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Career intake responses
CREATE TABLE public.career_intake_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  student_status text,
  educational_goal text,
  referral_sources text[] NOT NULL DEFAULT '{}',
  assistance_areas text[] NOT NULL DEFAULT '{}',
  obstacles text[] NOT NULL DEFAULT '{}',
  current_major text,
  accomplishment_goal text,
  career_influences text,
  dream_career text,
  considered_majors text,
  favorite_subjects text,
  least_favorite_subjects text,
  strengths_skills text,
  work_experience text,
  prior_assessments text,
  has_computer_access boolean,
  internet_skill_level text,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_intake_responses TO authenticated;
GRANT ALL ON public.career_intake_responses TO service_role;

ALTER TABLE public.career_intake_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage career intake"
  ON public.career_intake_responses FOR ALL TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id))
  WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Students can view own career intake"
  ON public.career_intake_responses FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER trg_career_intake_updated
  BEFORE UPDATE ON public.career_intake_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CMF fields on file_notes
ALTER TABLE public.file_notes
  ADD COLUMN contact_date date,
  ADD COLUMN contact_type text,
  ADD COLUMN duration_minutes int,
  ADD COLUMN identified_needs int[] NOT NULL DEFAULT '{}',
  ADD COLUMN referral_agency text,
  ADD COLUMN referral_contact text,
  ADD COLUMN next_steps text;

-- 4. CMF header fields on student_files
ALTER TABLE public.student_files
  ADD COLUMN mentor_name text,
  ADD COLUMN primary_reason_for_contact text,
  ADD COLUMN received_on_caseload_date date;
