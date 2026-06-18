-- 1. Rewrite RLS helpers as PL/pgSQL so PostgreSQL cannot inline them into
--    profile RLS policies (the SQL-function inlining was causing
--    "infinite recursion detected in policy for relation profiles").
--    Logic is preserved 1:1.

CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deactivated timestamptz;
BEGIN
  SELECT deactivated_at INTO v_deactivated
  FROM public.profiles
  WHERE user_id = _user_id;
  RETURN v_deactivated IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  ) INTO v_has;
  IF NOT v_has THEN
    RETURN false;
  END IF;
  RETURN public.is_user_active(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_org_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_suspended boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.training_organizations o ON o.id = p.organization_id
    WHERE p.user_id = _user_id AND o.suspended_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.training_organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user_id
      AND m.left_at IS NULL
      AND o.suspended_at IS NOT NULL
  ) INTO v_suspended;
  RETURN v_suspended;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'org_admin'
  ) INTO v_has;
  IF NOT v_has THEN
    RETURN false;
  END IF;
  RETURN public.is_user_active(_user_id);
END;
$$;

-- Preserve restricted execution rights set by earlier hardening migration.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_org_suspended(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_org_suspended(uuid) TO authenticated, service_role;

-- 2. Admin-only student data health summary, for pre/post-deploy checks.
CREATE OR REPLACE FUNCTION public.admin_student_data_health()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  students bigint,
  student_folders bigint,
  intake_responses bigint,
  checkins bigint,
  post_grad_plans bigint,
  support_requests bigint,
  certifications bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  RETURN QUERY
  WITH student_users AS (
    SELECT p.user_id, p.organization_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'student'
  ),
  student_org AS (
    SELECT su.user_id,
           COALESCE(su.organization_id,
                    (SELECT m.organization_id
                       FROM public.organization_memberships m
                      WHERE m.user_id = su.user_id AND m.left_at IS NULL
                      ORDER BY m.joined_at DESC LIMIT 1)) AS org_id
    FROM student_users su
  )
  SELECT
    o.id,
    o.name,
    COUNT(DISTINCT so.user_id),
    COUNT(DISTINCT sf.id),
    COUNT(DISTINCT ir.id),
    COUNT(DISTINCT sc.id),
    COUNT(DISTINCT pgp.id),
    COUNT(DISTINCT sr.id),
    COUNT(DISTINCT cert.id)
  FROM public.training_organizations o
  LEFT JOIN student_org so ON so.org_id = o.id
  LEFT JOIN public.student_files sf ON sf.student_id = so.user_id
  LEFT JOIN public.intake_responses ir ON ir.student_id = so.user_id
  LEFT JOIN public.student_checkins sc ON sc.student_id = so.user_id
  LEFT JOIN public.post_graduation_plans pgp ON pgp.student_id = so.user_id
  LEFT JOIN public.support_requests sr ON sr.student_id = so.user_id
  LEFT JOIN public.student_certifications cert ON cert.student_id = so.user_id
  GROUP BY o.id, o.name
  ORDER BY o.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_student_data_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_data_health() TO authenticated, service_role;