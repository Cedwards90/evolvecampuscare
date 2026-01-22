-- Allow students to view their assigned case manager's profile
CREATE POLICY "Students can view assigned case manager profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.student_assignments sa 
    WHERE sa.student_id = auth.uid() 
      AND sa.case_manager_id = profiles.user_id
  )
);