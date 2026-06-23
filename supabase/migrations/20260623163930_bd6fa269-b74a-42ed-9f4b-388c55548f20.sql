CREATE POLICY "Students update own assignments"
  ON public.impact_survey_assignments
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());