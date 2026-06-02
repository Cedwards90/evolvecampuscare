
-- 1. Add updated_at + trigger to student_checkins
ALTER TABLE public.student_checkins
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_student_checkins_updated_at ON public.student_checkins;
CREATE TRIGGER update_student_checkins_updated_at
BEFORE UPDATE ON public.student_checkins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add updated_at + trigger to intake_responses
ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_intake_responses_updated_at ON public.intake_responses;
CREATE TRIGGER update_intake_responses_updated_at
BEFORE UPDATE ON public.intake_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Student UPDATE policies
DROP POLICY IF EXISTS "Students can update own checkins" ON public.student_checkins;
CREATE POLICY "Students can update own checkins"
  ON public.student_checkins
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own plans" ON public.post_graduation_plans;
CREATE POLICY "Students can update own plans"
  ON public.post_graduation_plans
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own intake responses" ON public.intake_responses;
CREATE POLICY "Students can update own intake responses"
  ON public.intake_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
