
CREATE TABLE public.survey_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type text NOT NULL,
  student_id uuid NOT NULL,
  sent_by uuid NOT NULL,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins can manage all survey invitations"
ON public.survey_invitations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Case managers: insert for assigned students
CREATE POLICY "Case managers can send surveys to assigned students"
ON public.survey_invitations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'case_manager'::app_role)
  AND sent_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = survey_invitations.student_id
  )
);

-- Case managers: select for assigned students
CREATE POLICY "Case managers can view assigned student surveys"
ON public.survey_invitations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'case_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = survey_invitations.student_id
  )
);

-- Students: select own
CREATE POLICY "Students can view own survey invitations"
ON public.survey_invitations FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- Students: update own (to mark completed)
CREATE POLICY "Students can update own survey invitations"
ON public.survey_invitations FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
