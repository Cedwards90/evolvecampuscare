
-- 1) Tighten case_manager profile visibility
DROP POLICY IF EXISTS "Case managers view non-suspended profiles" ON public.profiles;

CREATE POLICY "Case managers view assigned students"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT is_user_org_suspended(user_id)
  AND EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid()
      AND sa.student_id = profiles.user_id
  )
);

-- Allow case managers to see other staff/admins in the system so messaging,
-- assignment pickers, etc. continue to function (no student PII leak).
CREATE POLICY "Case managers view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND NOT is_user_org_suspended(user_id)
  AND (
    has_role(user_id, 'admin'::app_role)
    OR has_role(user_id, 'case_manager'::app_role)
    OR is_org_admin(user_id)
  )
);

-- 2) Restrict training_organizations SELECT
DROP POLICY IF EXISTS "Authenticated users can view orgs" ON public.training_organizations;

CREATE POLICY "Staff can view all orgs"
ON public.training_organizations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'case_manager'::app_role)
  OR is_org_admin(auth.uid())
);

CREATE POLICY "Users can view their own org"
ON public.training_organizations
FOR SELECT
TO authenticated
USING (
  id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = training_organizations.id
      AND m.left_at IS NULL
  )
);

-- 3) Revoke broad EXECUTE on SECURITY DEFINER helpers from time-tracking
REVOKE EXECUTE ON FUNCTION public.validate_time_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_time_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.org_admin_can_access_time_entry(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_admin_can_access_time_entry(uuid, uuid) TO authenticated;
