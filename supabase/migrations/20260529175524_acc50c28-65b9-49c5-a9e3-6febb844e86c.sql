
-- training_organizations: org admin can only update when NOT suspended
DROP POLICY IF EXISTS "Org admins can suspend own org" ON public.training_organizations;
CREATE POLICY "Org admins can suspend own org"
  ON public.training_organizations FOR UPDATE TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND is_org_admin_of(auth.uid(), id)
    AND suspended_at IS NULL
  )
  WITH CHECK (
    is_org_admin(auth.uid())
    AND is_org_admin_of(auth.uid(), id)
  );

-- certification_catalog
DROP POLICY IF EXISTS "Org admins manage org catalog" ON public.certification_catalog;
CREATE POLICY "Org admins manage org catalog"
  ON public.certification_catalog FOR ALL TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  )
  WITH CHECK (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  );

-- funding_goals
DROP POLICY IF EXISTS "Org admins manage org goals" ON public.funding_goals;
CREATE POLICY "Org admins manage org goals"
  ON public.funding_goals FOR ALL TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  )
  WITH CHECK (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  );

-- qr_codes
DROP POLICY IF EXISTS "Org admins manage own org qr codes" ON public.qr_codes;
CREATE POLICY "Org admins manage own org qr codes"
  ON public.qr_codes FOR ALL TO authenticated
  USING (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  )
  WITH CHECK (
    is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  );

-- org_suspension_audit: org admins cannot insert audit rows for a suspended org (they can't act on it)
DROP POLICY IF EXISTS "Org admins insert own org suspension audit" ON public.org_suspension_audit;
CREATE POLICY "Org admins insert own org suspension audit"
  ON public.org_suspension_audit FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND is_org_admin(auth.uid())
    AND is_org_admin_of(auth.uid(), organization_id)
    AND NOT is_org_suspended(organization_id)
  );
