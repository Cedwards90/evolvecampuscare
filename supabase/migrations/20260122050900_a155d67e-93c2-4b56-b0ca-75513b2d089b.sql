-- Fix storage policy gaps: restrict case managers to only assigned students' files

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Case managers and admins can view all files" ON storage.objects;

-- Create separate policy for admins (full access)
CREATE POLICY "Admins can view all files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'request-attachments' AND
    public.has_role(auth.uid(), 'admin')
  );

-- Create restricted policy for case managers (only assigned students)
CREATE POLICY "Case managers can view assigned students files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'request-attachments' AND
    public.has_role(auth.uid(), 'case_manager') AND
    EXISTS (
      SELECT 1 FROM public.student_assignments sa
      WHERE sa.case_manager_id = auth.uid()
        AND sa.student_id::text = (storage.foldername(name))[1]
    )
  );