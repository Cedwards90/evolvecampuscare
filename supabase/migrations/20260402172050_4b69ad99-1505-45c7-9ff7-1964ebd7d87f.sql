
-- Allow admins to update any user's profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Backfill profiles.organization_id from active memberships
UPDATE public.profiles p
SET organization_id = om.organization_id
FROM public.organization_memberships om
WHERE om.user_id = p.user_id
  AND om.left_at IS NULL
  AND p.organization_id IS NULL;
