
CREATE TABLE public.student_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  mood_rating integer NOT NULL CHECK (mood_rating >= 1 AND mood_rating <= 5),
  progress_rating integer NOT NULL CHECK (progress_rating >= 1 AND progress_rating <= 5),
  blockers text,
  wins text,
  additional_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.student_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert their own check-ins"
  ON public.student_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own check-ins"
  ON public.student_checkins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Case managers can view assigned student check-ins"
  ON public.student_checkins
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'case_manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.student_assignments sa
      WHERE sa.case_manager_id = auth.uid()
        AND sa.student_id = student_checkins.student_id
    )
  );

CREATE POLICY "Admins can view all check-ins"
  ON public.student_checkins
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_student_checkins_student_id ON public.student_checkins (student_id);
CREATE INDEX idx_student_checkins_created_at ON public.student_checkins (student_id, created_at DESC);
