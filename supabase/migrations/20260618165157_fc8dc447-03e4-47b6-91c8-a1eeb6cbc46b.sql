
-- 1. Cohorts table
CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.training_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cohorts_org_name_unique ON public.cohorts (organization_id, lower(name));
CREATE INDEX cohorts_org_idx ON public.cohorts (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT ALL ON public.cohorts TO service_role;

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

-- SELECT: admins, org_admins of that org, case_managers, and members of that org
CREATE POLICY "Cohorts visible to staff and org members"
ON public.cohorts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'case_manager'::app_role)
  OR public.is_org_admin_of(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.organization_id = cohorts.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = cohorts.organization_id
      AND m.left_at IS NULL
  )
);

-- INSERT
CREATE POLICY "Admins and org admins can create cohorts"
ON public.cohorts FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_org_admin_of(auth.uid(), organization_id)
);

-- UPDATE
CREATE POLICY "Admins and org admins can update cohorts"
ON public.cohorts FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_org_admin_of(auth.uid(), organization_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_org_admin_of(auth.uid(), organization_id)
);

-- DELETE
CREATE POLICY "Admins and org admins can delete cohorts"
ON public.cohorts FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_org_admin_of(auth.uid(), organization_id)
);

CREATE TRIGGER update_cohorts_updated_at
BEFORE UPDATE ON public.cohorts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add cohort_id to profiles (nullable, preserves data on cohort delete)
ALTER TABLE public.profiles
ADD COLUMN cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX profiles_cohort_idx ON public.profiles (cohort_id);
