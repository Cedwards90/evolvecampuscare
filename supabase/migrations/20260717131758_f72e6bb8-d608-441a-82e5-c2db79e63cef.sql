
-- Ensure child tables cascade or nullify on support_requests delete
ALTER TABLE public.request_share_links DROP CONSTRAINT IF EXISTS request_share_links_request_id_fkey;
ALTER TABLE public.request_share_links ADD CONSTRAINT request_share_links_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.support_requests(id) ON DELETE CASCADE;

ALTER TABLE public.request_share_audit DROP CONSTRAINT IF EXISTS request_share_audit_request_id_fkey;
ALTER TABLE public.request_share_audit ADD CONSTRAINT request_share_audit_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.support_requests(id) ON DELETE CASCADE;

-- DELETE policies for support_requests
CREATE POLICY "Admins can delete requests"
  ON public.support_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Case managers can delete assigned requests"
  ON public.support_requests FOR DELETE
  USING (
    public.has_role(auth.uid(), 'case_manager'::app_role)
    AND assigned_case_manager_id = auth.uid()
    AND public.cm_can_access_student(auth.uid(), student_id)
  );

CREATE POLICY "Org admins can delete requests in scope"
  ON public.support_requests FOR DELETE
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );
