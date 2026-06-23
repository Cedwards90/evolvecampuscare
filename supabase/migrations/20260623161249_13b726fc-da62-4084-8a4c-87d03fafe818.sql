
-- participant-exports: add INSERT and DELETE policies for admins
CREATE POLICY "Admins can insert participant exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'participant-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete participant exports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'participant-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- student-certifications: add UPDATE policy for staff who can manage the student
CREATE POLICY "Staff can update student certification files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-certifications'
  AND public.can_staff_manage_student(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'student-certifications'
  AND public.can_staff_manage_student(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
