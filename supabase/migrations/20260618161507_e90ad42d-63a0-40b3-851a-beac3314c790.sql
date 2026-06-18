
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.org_admin_sees_user(_admin uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.org_admins oa ON oa.organization_id = m.organization_id
    JOIN public.training_organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user
      AND m.left_at IS NULL
      AND oa.user_id = _admin
      AND o.suspended_at IS NULL
  )
$$;

DROP POLICY IF EXISTS "Users can view their own org" ON public.training_organizations;
CREATE POLICY "Users can view their own org"
ON public.training_organizations
FOR SELECT
USING (
  id = public.get_user_org(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = training_organizations.id
      AND m.left_at IS NULL
  )
);

DROP POLICY IF EXISTS "Org admins view profiles via membership" ON public.profiles;
CREATE POLICY "Org admins view profiles via membership"
ON public.profiles
FOR SELECT
USING (
  is_org_admin(auth.uid())
  AND public.org_admin_sees_user(auth.uid(), user_id)
);
