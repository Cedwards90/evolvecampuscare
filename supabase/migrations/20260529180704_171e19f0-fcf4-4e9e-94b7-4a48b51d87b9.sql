
-- profiles: split admin/case-manager view, add suspension gate for case managers
DROP POLICY IF EXISTS "Case managers and admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Case managers view non-suspended profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(user_id)
);

-- support_requests
DROP POLICY IF EXISTS "Case managers can view assigned requests" ON public.support_requests;
CREATE POLICY "Case managers can view assigned requests"
ON public.support_requests FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND assigned_case_manager_id = auth.uid()
  AND NOT public.is_user_org_suspended(student_id)
);

DROP POLICY IF EXISTS "Case managers can update assigned requests" ON public.support_requests;
CREATE POLICY "Case managers can update assigned requests"
ON public.support_requests FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND assigned_case_manager_id = auth.uid()
  AND NOT public.is_user_org_suspended(student_id)
);

-- appointments
DROP POLICY IF EXISTS "Case managers can view their appointments" ON public.appointments;
CREATE POLICY "Case managers can view their appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND auth.uid() = case_manager_id
  AND NOT public.is_user_org_suspended(student_id)
);

DROP POLICY IF EXISTS "Case managers can create appointments" ON public.appointments;
CREATE POLICY "Case managers can create appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND auth.uid() = case_manager_id
  AND NOT public.is_user_org_suspended(student_id)
);

DROP POLICY IF EXISTS "Participants can update appointments" ON public.appointments;
CREATE POLICY "Participants can update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (
  (auth.uid() = student_id)
  OR (auth.uid() = case_manager_id AND NOT public.is_user_org_suspended(student_id))
);

-- file_notes
DROP POLICY IF EXISTS "Case managers can view assigned student notes" ON public.file_notes;
CREATE POLICY "Case managers can view assigned student notes"
ON public.file_notes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id)
);

DROP POLICY IF EXISTS "Case managers can add notes for assigned students" ON public.file_notes;
CREATE POLICY "Case managers can add notes for assigned students"
ON public.file_notes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id)
);

DROP POLICY IF EXISTS "Case managers can update their own notes" ON public.file_notes;
CREATE POLICY "Case managers can update their own notes"
ON public.file_notes FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  AND has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id)
)
WITH CHECK (
  author_id = auth.uid()
  AND has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id)
);

DROP POLICY IF EXISTS "Case managers can delete their own notes" ON public.file_notes;
CREATE POLICY "Case managers can delete their own notes"
ON public.file_notes FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  AND has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
);

-- intake_responses
DROP POLICY IF EXISTS "Case managers can view assigned student intake" ON public.intake_responses;
CREATE POLICY "Case managers can view assigned student intake"
ON public.intake_responses FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = intake_responses.student_id)
);

-- post_graduation_plans
DROP POLICY IF EXISTS "Case managers can view assigned student plans" ON public.post_graduation_plans;
CREATE POLICY "Case managers can view assigned student plans"
ON public.post_graduation_plans FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = post_graduation_plans.student_id)
);

-- student_checkins
DROP POLICY IF EXISTS "Case managers can view assigned student check-ins" ON public.student_checkins;
CREATE POLICY "Case managers can view assigned student check-ins"
ON public.student_checkins FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = student_checkins.student_id)
);

-- student_files
DROP POLICY IF EXISTS "Case managers can view assigned student files" ON public.student_files;
CREATE POLICY "Case managers can view assigned student files"
ON public.student_files FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = student_files.student_id)
);

-- student_assignments
DROP POLICY IF EXISTS "Case managers can view their students" ON public.student_assignments;
CREATE POLICY "Case managers can view their students"
ON public.student_assignments FOR SELECT TO authenticated
USING (
  case_manager_id = auth.uid()
  AND has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
);

-- survey_invitations
DROP POLICY IF EXISTS "Case managers can view assigned student surveys" ON public.survey_invitations;
CREATE POLICY "Case managers can view assigned student surveys"
ON public.survey_invitations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = survey_invitations.student_id)
);

DROP POLICY IF EXISTS "Case managers can send surveys to assigned students" ON public.survey_invitations;
CREATE POLICY "Case managers can send surveys to assigned students"
ON public.survey_invitations FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND sent_by = auth.uid()
  AND NOT public.is_user_org_suspended(student_id)
  AND EXISTS (SELECT 1 FROM student_assignments sa
              WHERE sa.case_manager_id = auth.uid() AND sa.student_id = survey_invitations.student_id)
);

-- request_attachments: case-manager branch gated; student/admin untouched
DROP POLICY IF EXISTS "Users can view attachments for accessible requests" ON public.request_attachments;
CREATE POLICY "Users can view attachments for accessible requests"
ON public.request_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_requests sr
    WHERE sr.id = request_attachments.request_id
      AND (
        sr.student_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR (sr.assigned_case_manager_id = auth.uid() AND NOT public.is_user_org_suspended(sr.student_id))
      )
  )
);

DROP POLICY IF EXISTS "Participants can upload attachments" ON public.request_attachments;
CREATE POLICY "Participants can upload attachments"
ON public.request_attachments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM support_requests sr
    WHERE sr.id = request_attachments.request_id
      AND (
        sr.student_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR (sr.assigned_case_manager_id = auth.uid() AND NOT public.is_user_org_suspended(sr.student_id))
      )
  )
);

-- ai_insights: gate case manager via the linked request's student
DROP POLICY IF EXISTS "Case managers can view their insights" ON public.ai_insights;
CREATE POLICY "Case managers can view their insights"
ON public.ai_insights FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND case_manager_id = auth.uid()
  AND (
    request_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM support_requests sr
      WHERE sr.id = ai_insights.request_id
        AND public.is_user_org_suspended(sr.student_id)
    )
  )
);

DROP POLICY IF EXISTS "Case managers can update their insights" ON public.ai_insights;
CREATE POLICY "Case managers can update their insights"
ON public.ai_insights FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND case_manager_id = auth.uid()
  AND (
    request_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM support_requests sr
      WHERE sr.id = ai_insights.request_id
        AND public.is_user_org_suspended(sr.student_id)
    )
  )
);
