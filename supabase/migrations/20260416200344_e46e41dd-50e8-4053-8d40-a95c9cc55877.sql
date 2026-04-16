
-- Extend INSERT policy on request_attachments to allow staff
DROP POLICY IF EXISTS "Users can upload attachments to their requests" ON public.request_attachments;

CREATE POLICY "Participants can upload attachments"
  ON public.request_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id = request_attachments.request_id
        AND (
          sr.student_id = auth.uid()
          OR sr.assigned_case_manager_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

-- Allow uploader (or admin) to delete an attachment row
CREATE POLICY "Uploader or admin can delete attachments"
  ON public.request_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Storage policies for the request-attachments bucket
-- Path convention: {request_id}/{uuid}-{filename}
DROP POLICY IF EXISTS "Participants can read request attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Participants can upload request attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Uploader or admin can delete request attachment files" ON storage.objects;

CREATE POLICY "Participants can read request attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id::text = (storage.foldername(name))[1]
        AND (
          sr.student_id = auth.uid()
          OR sr.assigned_case_manager_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Participants can upload request attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id::text = (storage.foldername(name))[1]
        AND (
          sr.student_id = auth.uid()
          OR sr.assigned_case_manager_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Uploader or admin can delete request attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
