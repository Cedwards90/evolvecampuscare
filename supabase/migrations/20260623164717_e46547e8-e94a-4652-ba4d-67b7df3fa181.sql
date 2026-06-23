
ALTER TABLE public.community_resources ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.community_resources ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE POLICY "Staff can insert resources"
  ON public.community_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'case_manager'::app_role)
    OR is_org_admin(auth.uid())
  );

CREATE POLICY "Staff can update own resources"
  ON public.community_resources
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      has_role(auth.uid(), 'case_manager'::app_role)
      OR is_org_admin(auth.uid())
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND (
      has_role(auth.uid(), 'case_manager'::app_role)
      OR is_org_admin(auth.uid())
    )
  );

CREATE POLICY "Staff can delete own resources"
  ON public.community_resources
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      has_role(auth.uid(), 'case_manager'::app_role)
      OR is_org_admin(auth.uid())
    )
  );
