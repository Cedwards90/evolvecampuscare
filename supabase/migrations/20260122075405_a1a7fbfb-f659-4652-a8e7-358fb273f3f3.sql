-- Add RLS policies for students to use messaging

-- Students can view messages where they are sender or recipient
CREATE POLICY "Students can view their messages"
  ON public.staff_messages FOR SELECT
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

-- Students can send messages to their assigned case manager or admins
CREATE POLICY "Students can send messages"
  ON public.staff_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    (
      -- Can message their assigned case manager
      EXISTS (
        SELECT 1 FROM student_assignments
        WHERE student_id = auth.uid()
        AND case_manager_id = staff_messages.recipient_id
      )
      OR
      -- Can message admins
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = staff_messages.recipient_id
        AND role = 'admin'
      )
    )
  );

-- Students can update read status on their received messages
CREATE POLICY "Students can update their message read status"
  ON public.staff_messages FOR UPDATE
  USING (recipient_id = auth.uid());