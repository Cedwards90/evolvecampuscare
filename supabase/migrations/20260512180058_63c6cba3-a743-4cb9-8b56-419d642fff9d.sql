
-- Enum for certification status
DO $$ BEGIN
  CREATE TYPE public.certification_status AS ENUM ('in_progress','completed','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catalog of predefined certifications
CREATE TABLE public.certification_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  default_validity_months integer,
  issuing_organization text,
  organization_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX certification_catalog_name_org_uniq
  ON public.certification_catalog (lower(name), COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.certification_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog"
  ON public.certification_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all catalog"
  ON public.certification_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins manage org catalog"
  ON public.certification_catalog FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_certification_catalog_updated
  BEFORE UPDATE ON public.certification_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-student certifications
CREATE TABLE public.student_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  catalog_id uuid REFERENCES public.certification_catalog(id) ON DELETE SET NULL,
  custom_name text,
  issuing_organization text,
  status public.certification_status NOT NULL DEFAULT 'in_progress',
  completion_date date,
  expiration_date date,
  credential_id text,
  notes text,
  file_path text,
  file_name text,
  mime_type text,
  file_size integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cert_name_xor CHECK (
    (catalog_id IS NOT NULL AND (custom_name IS NULL OR length(trim(custom_name)) = 0))
    OR (catalog_id IS NULL AND custom_name IS NOT NULL AND length(trim(custom_name)) > 0)
  ),
  CONSTRAINT cert_dates_ok CHECK (
    expiration_date IS NULL OR completion_date IS NULL OR expiration_date >= completion_date
  )
);

CREATE INDEX student_certifications_student_idx ON public.student_certifications(student_id);
CREATE INDEX student_certifications_expiration_idx ON public.student_certifications(expiration_date);

ALTER TABLE public.student_certifications ENABLE ROW LEVEL SECURITY;

-- Helper: can the actor manage certs for the given student?
CREATE OR REPLACE FUNCTION public.can_staff_manage_student(_actor uuid, _student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_actor, 'admin'::app_role)
    OR (
      public.has_role(_actor, 'case_manager'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.student_assignments sa
        WHERE sa.case_manager_id = _actor AND sa.student_id = _student
      )
    )
    OR (
      public.is_org_admin(_actor)
      AND public.user_in_org_admin_scope_v2(_actor, _student)
    );
$$;

CREATE POLICY "Students view own certs"
  ON public.student_certifications FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Staff view student certs"
  ON public.student_certifications FOR SELECT TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Staff insert student certs"
  ON public.student_certifications FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_staff_manage_student(auth.uid(), student_id)
  );

CREATE POLICY "Staff update student certs"
  ON public.student_certifications FOR UPDATE TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id))
  WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Staff delete student certs"
  ON public.student_certifications FOR DELETE TO authenticated
  USING (public.can_staff_manage_student(auth.uid(), student_id));

CREATE TRIGGER trg_student_certifications_updated
  BEFORE UPDATE ON public.student_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for cert files
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-certifications', 'student-certifications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path is {student_id}/{cert_id}/{filename}
CREATE POLICY "Students read own cert files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-certifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Staff read student cert files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-certifications'
    AND public.can_staff_manage_student(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "Staff upload student cert files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-certifications'
    AND public.can_staff_manage_student(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "Staff delete student cert files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-certifications'
    AND public.can_staff_manage_student(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );
