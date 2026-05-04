-- Share request as PDF: secure links + audit log

CREATE TYPE public.share_action AS ENUM ('download','email','link_created','link_revoked','link_accessed');

CREATE TABLE public.request_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_request_share_links_request ON public.request_share_links(request_id);
CREATE INDEX idx_request_share_links_token ON public.request_share_links(token);

CREATE TABLE public.request_share_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  actor_id uuid,
  action share_action NOT NULL,
  recipients text[],
  share_link_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_share_audit_request ON public.request_share_audit(request_id);

ALTER TABLE public.request_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_share_audit ENABLE ROW LEVEL SECURITY;

-- Helper: can a staff user access this request?
CREATE OR REPLACE FUNCTION public.can_staff_access_request(_user uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_requests sr
    WHERE sr.id = _request_id AND (
      public.has_role(_user, 'admin'::app_role)
      OR (public.has_role(_user, 'case_manager'::app_role) AND sr.assigned_case_manager_id = _user)
      OR (public.is_org_admin(_user) AND public.user_in_org_admin_scope(_user, sr.student_id))
    )
  )
$$;

-- request_share_links policies
CREATE POLICY "Staff view share links for accessible requests"
  ON public.request_share_links FOR SELECT TO authenticated
  USING (public.can_staff_access_request(auth.uid(), request_id));

CREATE POLICY "Staff create share links for accessible requests"
  ON public.request_share_links FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_staff_access_request(auth.uid(), request_id));

CREATE POLICY "Staff revoke share links for accessible requests"
  ON public.request_share_links FOR UPDATE TO authenticated
  USING (public.can_staff_access_request(auth.uid(), request_id))
  WITH CHECK (public.can_staff_access_request(auth.uid(), request_id));

-- request_share_audit policies (append-only for staff; service-role inserts via edge)
CREATE POLICY "Staff view audit for accessible requests"
  ON public.request_share_audit FOR SELECT TO authenticated
  USING (public.can_staff_access_request(auth.uid(), request_id));

CREATE POLICY "Staff insert audit for accessible requests"
  ON public.request_share_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.can_staff_access_request(auth.uid(), request_id));