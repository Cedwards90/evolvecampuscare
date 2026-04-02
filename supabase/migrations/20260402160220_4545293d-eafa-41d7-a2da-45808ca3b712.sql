-- profiles: Students can view assigned case manager profile
DROP POLICY IF EXISTS "Students can view assigned case manager profile" ON public.profiles;
CREATE POLICY "Students can view assigned case manager profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM student_assignments sa
    WHERE sa.student_id = auth.uid() AND sa.case_manager_id = profiles.user_id
  ));

-- student_assignments: fix all three policies
DROP POLICY IF EXISTS "Admins can manage student assignments" ON public.student_assignments;
CREATE POLICY "Admins can manage student assignments"
  ON public.student_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Case managers can view their students" ON public.student_assignments;
CREATE POLICY "Case managers can view their students"
  ON public.student_assignments FOR SELECT
  TO authenticated
  USING (case_manager_id = auth.uid() AND public.has_role(auth.uid(), 'case_manager'));

DROP POLICY IF EXISTS "Students can view their assignment" ON public.student_assignments;
CREATE POLICY "Students can view their assignment"
  ON public.student_assignments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- user_invitations: fix all three policies
DROP POLICY IF EXISTS "Admins can manage all invitations" ON public.user_invitations;
CREATE POLICY "Admins can manage all invitations"
  ON public.user_invitations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Case managers can invite students" ON public.user_invitations;
CREATE POLICY "Case managers can invite students"
  ON public.user_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'case_manager') AND invited_role = 'student' AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Case managers can view their invitations" ON public.user_invitations;
CREATE POLICY "Case managers can view their invitations"
  ON public.user_invitations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'case_manager') AND invited_by = auth.uid());

-- staff_messages: fix student policies
DROP POLICY IF EXISTS "Students can send messages" ON public.staff_messages;
CREATE POLICY "Students can send messages"
  ON public.staff_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM student_assignments WHERE student_id = auth.uid() AND case_manager_id = staff_messages.recipient_id)
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = staff_messages.recipient_id AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Students can update their message read status" ON public.staff_messages;
CREATE POLICY "Students can update their message read status"
  ON public.staff_messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Students can view their messages" ON public.staff_messages;
CREATE POLICY "Students can view their messages"
  ON public.staff_messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- site_settings: fix admin policy
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));