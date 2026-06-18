DROP POLICY IF EXISTS "CM inserts own entries" ON public.time_entries;

CREATE POLICY "CM inserts own entries"
ON public.time_entries
FOR INSERT
WITH CHECK (
  case_manager_id = auth.uid()
  AND (has_role(auth.uid(), 'case_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins insert any entry"
ON public.time_entries
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins insert in scope"
ON public.time_entries
FOR INSERT
WITH CHECK (
  is_org_admin(auth.uid())
  AND user_in_org_admin_scope_v2(auth.uid(), case_manager_id)
);