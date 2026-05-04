
-- ============================================================
-- Org Admin: table, helpers, and RLS extensions
-- ============================================================

-- Mapping table: which orgs an org admin governs (multi-org)
CREATE TABLE IF NOT EXISTS public.org_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_admins_user ON public.org_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_org_admins_org ON public.org_admins(organization_id);

ALTER TABLE public.org_admins ENABLE ROW LEVEL SECURITY;

-- Only full admins manage org_admins. Org admins themselves can read their own rows.
CREATE POLICY "Admins manage org_admins"
  ON public.org_admins
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can view own assignments"
  ON public.org_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Helper functions (SECURITY DEFINER, immutable search_path)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'org_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_of(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_admins
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.org_admin_orgs(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.org_admins WHERE user_id = _user_id
$$;

-- Helper: does the user belong to one of the org admin's orgs?
CREATE OR REPLACE FUNCTION public.user_in_org_admin_scope(_actor uuid, _target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.org_admins oa
      ON oa.organization_id = p.organization_id
    WHERE p.user_id = _target_user
      AND oa.user_id = _actor
  )
$$;

-- Lock down EXECUTE: only authenticated users can call these helpers
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_admin_orgs(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_in_org_admin_scope(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_admin_orgs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_org_admin_scope(uuid, uuid) TO authenticated;

-- ============================================================
-- RLS extensions for Org Admins
-- ============================================================

-- profiles: view profiles in their org(s)
CREATE POLICY "Org admins view profiles in their orgs"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  );

-- user_roles: view roles for users in their org(s) (read-only)
CREATE POLICY "Org admins view roles in their orgs"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), user_id)
  );

-- organization_memberships: view rows for their orgs
CREATE POLICY "Org admins view org memberships"
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.is_org_admin_of(auth.uid(), organization_id)
  );

-- support_requests: view + update for students in their orgs
CREATE POLICY "Org admins view support_requests"
  ON public.support_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

CREATE POLICY "Org admins update support_requests"
  ON public.support_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- request_updates: view (non-internal already gated by participant check; org admin sees all in scope)
CREATE POLICY "Org admins view request_updates"
  ON public.request_updates
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id = request_updates.request_id
        AND public.user_in_org_admin_scope(auth.uid(), sr.student_id)
    )
  );

CREATE POLICY "Org admins create request_updates"
  ON public.request_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id = request_updates.request_id
        AND public.user_in_org_admin_scope(auth.uid(), sr.student_id)
    )
  );

-- request_attachments: view in scope
CREATE POLICY "Org admins view request_attachments"
  ON public.request_attachments
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_requests sr
      WHERE sr.id = request_attachments.request_id
        AND public.user_in_org_admin_scope(auth.uid(), sr.student_id)
    )
  );

-- student_assignments: view + insert + update in scope
CREATE POLICY "Org admins view student_assignments"
  ON public.student_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

CREATE POLICY "Org admins create student_assignments"
  ON public.student_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
    AND public.user_in_org_admin_scope(auth.uid(), case_manager_id)
  );

CREATE POLICY "Org admins update student_assignments"
  ON public.student_assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
    AND public.user_in_org_admin_scope(auth.uid(), case_manager_id)
  );

CREATE POLICY "Org admins delete student_assignments"
  ON public.student_assignments
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- student_files: view in scope
CREATE POLICY "Org admins view student_files"
  ON public.student_files
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- file_notes: view in scope (no write — case notes stay with case managers)
CREATE POLICY "Org admins view file_notes"
  ON public.file_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- intake_responses
CREATE POLICY "Org admins view intake_responses"
  ON public.intake_responses
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- post_graduation_plans
CREATE POLICY "Org admins view post_graduation_plans"
  ON public.post_graduation_plans
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- student_checkins
CREATE POLICY "Org admins view student_checkins"
  ON public.student_checkins
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- survey_invitations
CREATE POLICY "Org admins view survey_invitations"
  ON public.survey_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- appointments: view in scope
CREATE POLICY "Org admins view appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- staff_messages: view messages where the linked student is in scope
CREATE POLICY "Org admins view staff_messages"
  ON public.staff_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND student_id IS NOT NULL
    AND public.user_in_org_admin_scope(auth.uid(), student_id)
  );

-- user_invitations: org admins create invites locked to their orgs (students or case managers only)
CREATE POLICY "Org admins create invitations"
  ON public.user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND invited_by = auth.uid()
    AND invited_role IN ('student'::app_role, 'case_manager'::app_role)
    AND organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  );

CREATE POLICY "Org admins view their invitations"
  ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND invited_by = auth.uid()
  );

-- training_organizations: org admins can view orgs they manage (already covered by 'all authenticated can view')
-- intentionally NO write policy — org admins cannot edit org records.
