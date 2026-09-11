CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_documents_student ON public.student_documents(student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO authenticated;
GRANT ALL ON public.student_documents TO service_role;

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student documents"
ON public.student_documents FOR SELECT TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Staff can upload student documents"
ON public.student_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.can_staff_manage_student(auth.uid(), student_id)
);

CREATE POLICY "Uploader can update own student documents"
ON public.student_documents FOR UPDATE TO authenticated
USING (
  public.can_staff_manage_student(auth.uid(), student_id)
  AND (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), student_id))
  )
)
WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Uploader or admins can delete student documents"
ON public.student_documents FOR DELETE TO authenticated
USING (
  public.can_staff_manage_student(auth.uid(), student_id)
  AND (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), student_id))
  )
);

CREATE TRIGGER trg_student_documents_updated
BEFORE UPDATE ON public.student_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the private student-documents bucket
CREATE POLICY "Staff can read student document objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-documents'
  AND public.can_staff_manage_student(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Staff can upload student document objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-documents'
  AND public.can_staff_manage_student(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Staff can delete student document objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-documents'
  AND public.can_staff_manage_student(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), ((storage.foldername(name))[1])::uuid))
  )
);