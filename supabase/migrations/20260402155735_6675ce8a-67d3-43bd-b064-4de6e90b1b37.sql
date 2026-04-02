-- Fix 1: Remove overly permissive case manager SELECT policy on support_requests
-- Currently allows case managers to see ALL unassigned requests
DROP POLICY IF EXISTS "Case managers can view assigned requests" ON public.support_requests;

CREATE POLICY "Case managers can view assigned requests"
    ON public.support_requests FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        assigned_case_manager_id = auth.uid()
    );

-- Fix 2: Add DELETE policies on request-attachments storage bucket
-- Allow students to delete their own uploaded files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to delete any file
CREATE POLICY "Admins can delete any file"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-attachments'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow case managers to delete files for assigned students
CREATE POLICY "Case managers can delete assigned student files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-attachments'
  AND public.has_role(auth.uid(), 'case_manager')
  AND EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid()
      AND sa.student_id::text = (storage.foldername(name))[1]
  )
);