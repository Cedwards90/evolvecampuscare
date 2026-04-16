CREATE POLICY "Admins and authoring case managers can delete updates"
ON public.request_updates FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'case_manager')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_requests sr
      WHERE sr.id = request_updates.request_id
        AND sr.assigned_case_manager_id = auth.uid()
    )
  )
);