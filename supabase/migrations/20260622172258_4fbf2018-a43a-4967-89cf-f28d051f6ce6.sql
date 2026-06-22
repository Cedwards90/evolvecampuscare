CREATE POLICY "Students can insert own career intake"
  ON public.career_intake_responses FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own career intake"
  ON public.career_intake_responses FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can insert own personality profile"
  ON public.student_personality_profiles FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own personality profile"
  ON public.student_personality_profiles FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());