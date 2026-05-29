
-- 1. Add suspension columns
ALTER TABLE public.training_organizations
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Helper: is the org suspended?
CREATE OR REPLACE FUNCTION public.is_org_suspended(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.training_organizations
    WHERE id = _org_id AND suspended_at IS NOT NULL
  );
$$;

-- 3. Helper: is this user inside any suspended org (profile org or active membership)?
CREATE OR REPLACE FUNCTION public.is_user_org_suspended(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.training_organizations o ON o.id = p.organization_id
    WHERE p.user_id = _user_id AND o.suspended_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.training_organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user_id
      AND m.left_at IS NULL
      AND o.suspended_at IS NOT NULL
  );
$$;

-- 4. Update can_staff_manage_student to hide suspended-org students from non-admins
CREATE OR REPLACE FUNCTION public.can_staff_manage_student(_actor UUID, _student UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_actor, 'admin'::app_role)
    OR (
      public.has_role(_actor, 'case_manager'::app_role)
      AND NOT public.is_user_org_suspended(_student)
      AND EXISTS (
        SELECT 1 FROM public.student_assignments sa
        WHERE sa.case_manager_id = _actor AND sa.student_id = _student
      )
    )
    OR (
      public.is_org_admin(_actor)
      AND NOT public.is_user_org_suspended(_student)
      AND public.user_in_org_admin_scope_v2(_actor, _student)
    );
$$;

-- 5. Update user_in_org_admin_scope_v2 to exclude suspended orgs
CREATE OR REPLACE FUNCTION public.user_in_org_admin_scope_v2(_actor UUID, _target_user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_admins oa
    JOIN public.training_organizations o ON o.id = oa.organization_id
    WHERE oa.user_id = _actor
      AND o.suspended_at IS NULL
      AND (
        oa.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = _target_user)
        OR oa.organization_id IN (
          SELECT organization_id FROM public.organization_memberships
          WHERE user_id = _target_user AND left_at IS NULL
        )
      )
  );
$$;

-- 6. Update user_in_org_admin_scope (legacy) to exclude suspended orgs
CREATE OR REPLACE FUNCTION public.user_in_org_admin_scope(_actor UUID, _target_user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.org_admins oa ON oa.organization_id = p.organization_id
    JOIN public.training_organizations o ON o.id = oa.organization_id
    WHERE p.user_id = _target_user
      AND oa.user_id = _actor
      AND o.suspended_at IS NULL
  );
$$;

-- 7. Update profiles org-admin SELECT policies to exclude suspended orgs
DROP POLICY IF EXISTS "Org admins view profiles in their orgs" ON public.profiles;
CREATE POLICY "Org admins view profiles in their orgs"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  );

DROP POLICY IF EXISTS "Org admins view profiles via membership" ON public.profiles;
CREATE POLICY "Org admins view profiles via membership"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM organization_memberships m
      JOIN org_admins oa ON oa.organization_id = m.organization_id
      JOIN training_organizations o ON o.id = m.organization_id
      WHERE m.user_id = profiles.user_id
        AND m.left_at IS NULL
        AND oa.user_id = auth.uid()
        AND o.suspended_at IS NULL
    )
  );

-- 8. Audit table
CREATE TABLE IF NOT EXISTS public.org_suspension_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('suspended','reinstated')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.org_suspension_audit TO authenticated;
GRANT ALL ON public.org_suspension_audit TO service_role;

ALTER TABLE public.org_suspension_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage suspension audit"
  ON public.org_suspension_audit FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins view own org suspension audit"
  ON public.org_suspension_audit FOR SELECT TO authenticated
  USING (is_org_admin(auth.uid()) AND is_org_admin_of(auth.uid(), organization_id));

CREATE POLICY "Org admins insert own org suspension audit"
  ON public.org_suspension_audit FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND is_org_admin(auth.uid())
    AND is_org_admin_of(auth.uid(), organization_id)
  );

-- 9. Allow org admins to update suspension fields on their own orgs
-- (Admins already covered by existing "manage" policies; verify by checking training_organizations policies.)
-- training_organizations doesn't have an org-admin UPDATE policy yet; add one scoped to their orgs.
CREATE POLICY "Org admins can suspend own org"
  ON public.training_organizations FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid()) AND is_org_admin_of(auth.uid(), id))
  WITH CHECK (is_org_admin(auth.uid()) AND is_org_admin_of(auth.uid(), id));

CREATE INDEX IF NOT EXISTS idx_org_suspension_audit_org ON public.org_suspension_audit(organization_id, created_at DESC);
