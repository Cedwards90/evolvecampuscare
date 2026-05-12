CREATE TABLE public.folder_summary_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('generated', 'downloaded_pdf')),
  section_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_folder_summary_audit_student ON public.folder_summary_audit(student_id, created_at DESC);

ALTER TABLE public.folder_summary_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff insert folder summary audit"
ON public.folder_summary_audit FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND public.can_staff_manage_student(auth.uid(), student_id));

CREATE POLICY "Staff view folder summary audit"
ON public.folder_summary_audit FOR SELECT TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id));