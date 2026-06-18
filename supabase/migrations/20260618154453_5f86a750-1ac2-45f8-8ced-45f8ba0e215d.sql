
-- Helper: returns true if _actor (a case manager) is assigned to _student
CREATE OR REPLACE FUNCTION public.cm_has_assignment(_actor uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = _actor
      AND sa.student_id = _student
  );
$$;

REVOKE EXECUTE ON FUNCTION public.cm_has_assignment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cm_has_assignment(uuid, uuid) TO authenticated;

-- Replace the policy to use the SECURITY DEFINER helper (avoids any nested-RLS edge cases)
DROP POLICY IF EXISTS "Case managers view assigned students" ON public.profiles;

CREATE POLICY "Case managers view assigned students"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND public.cm_has_assignment(auth.uid(), user_id)
);
