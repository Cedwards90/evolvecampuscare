CREATE POLICY "Authenticated view active templates"
  ON public.impact_survey_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);