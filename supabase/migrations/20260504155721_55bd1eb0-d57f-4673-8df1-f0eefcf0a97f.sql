
ALTER TABLE public.file_notes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_file_notes_updated_at ON public.file_notes;
CREATE TRIGGER update_file_notes_updated_at
  BEFORE UPDATE ON public.file_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Remove student visibility — case notes are staff-only
DROP POLICY IF EXISTS "Students can view own file notes" ON public.file_notes;

-- Authors can update their own notes (only on assigned students)
DROP POLICY IF EXISTS "Case managers can update their own notes" ON public.file_notes;
CREATE POLICY "Case managers can update their own notes"
  ON public.file_notes
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND has_role(auth.uid(), 'case_manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.student_assignments sa
      WHERE sa.case_manager_id = auth.uid()
        AND sa.student_id = file_notes.student_id
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    AND has_role(auth.uid(), 'case_manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.student_assignments sa
      WHERE sa.case_manager_id = auth.uid()
        AND sa.student_id = file_notes.student_id
    )
  );

-- Authors can delete their own notes
DROP POLICY IF EXISTS "Case managers can delete their own notes" ON public.file_notes;
CREATE POLICY "Case managers can delete their own notes"
  ON public.file_notes
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND has_role(auth.uid(), 'case_manager'::app_role)
  );
