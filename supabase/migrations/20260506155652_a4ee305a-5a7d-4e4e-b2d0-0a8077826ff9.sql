-- 1. Backfill profiles.organization_id from active memberships
UPDATE public.profiles p
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_memberships
  WHERE left_at IS NULL
  ORDER BY user_id, joined_at DESC
) m
WHERE p.user_id = m.user_id
  AND p.organization_id IS DISTINCT FROM m.organization_id
  AND p.organization_id IS NULL;

-- 2. Sync trigger: keep profiles.organization_id aligned with active memberships
CREATE OR REPLACE FUNCTION public.sync_profile_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fallback_org uuid;
  current_org uuid;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.left_at IS NULL AND OLD.left_at IS NOT NULL) THEN
    -- New active membership: set profile org if currently null
    UPDATE public.profiles
    SET organization_id = NEW.organization_id
    WHERE user_id = NEW.user_id
      AND organization_id IS NULL;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE' AND NEW.left_at IS NOT NULL AND OLD.left_at IS NULL) THEN
    -- Membership ended: if profile pointed at this org, fall back
    SELECT organization_id INTO current_org FROM public.profiles WHERE user_id = NEW.user_id;
    IF current_org = NEW.organization_id THEN
      SELECT organization_id INTO fallback_org
      FROM public.organization_memberships
      WHERE user_id = NEW.user_id
        AND left_at IS NULL
        AND organization_id <> NEW.organization_id
      ORDER BY joined_at DESC
      LIMIT 1;
      UPDATE public.profiles
      SET organization_id = fallback_org
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_organization_trg ON public.organization_memberships;
CREATE TRIGGER sync_profile_organization_trg
AFTER INSERT OR UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_organization();

-- 3. Helper: org-admin-in-scope via profile OR active membership
CREATE OR REPLACE FUNCTION public.user_in_org_admin_scope_v2(_actor uuid, _target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_admins oa
    WHERE oa.user_id = _actor
      AND (
        oa.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = _target_user)
        OR oa.organization_id IN (
          SELECT organization_id FROM public.organization_memberships
          WHERE user_id = _target_user AND left_at IS NULL
        )
      )
  );
$$;

-- 4. Belt-and-suspenders profiles SELECT policy
DROP POLICY IF EXISTS "Org admins view profiles via membership" ON public.profiles;
CREATE POLICY "Org admins view profiles via membership"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_org_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.org_admins oa ON oa.organization_id = m.organization_id
    WHERE m.user_id = profiles.user_id
      AND m.left_at IS NULL
      AND oa.user_id = auth.uid()
  )
);

-- 5. Update org-admin SELECT policies on related tables to use v2 helper
DROP POLICY IF EXISTS "Org admins view appointments" ON public.appointments;
CREATE POLICY "Org admins view appointments" ON public.appointments FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view file_notes" ON public.file_notes;
CREATE POLICY "Org admins view file_notes" ON public.file_notes FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view intake_responses" ON public.intake_responses;
CREATE POLICY "Org admins view intake_responses" ON public.intake_responses FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view post_graduation_plans" ON public.post_graduation_plans;
CREATE POLICY "Org admins view post_graduation_plans" ON public.post_graduation_plans FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view student_assignments" ON public.student_assignments;
CREATE POLICY "Org admins view student_assignments" ON public.student_assignments FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view student_checkins" ON public.student_checkins;
CREATE POLICY "Org admins view student_checkins" ON public.student_checkins FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view student_files" ON public.student_files;
CREATE POLICY "Org admins view student_files" ON public.student_files FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view staff_messages" ON public.staff_messages;
CREATE POLICY "Org admins view staff_messages" ON public.staff_messages FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND student_id IS NOT NULL AND user_in_org_admin_scope_v2(auth.uid(), student_id));

DROP POLICY IF EXISTS "Org admins view request_attachments" ON public.request_attachments;
CREATE POLICY "Org admins view request_attachments" ON public.request_attachments FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.support_requests sr
  WHERE sr.id = request_attachments.request_id
    AND user_in_org_admin_scope_v2(auth.uid(), sr.student_id)
));

DROP POLICY IF EXISTS "Org admins view request_updates" ON public.request_updates;
CREATE POLICY "Org admins view request_updates" ON public.request_updates FOR SELECT TO authenticated
USING (is_org_admin(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.support_requests sr
  WHERE sr.id = request_updates.request_id
    AND user_in_org_admin_scope_v2(auth.uid(), sr.student_id)
));