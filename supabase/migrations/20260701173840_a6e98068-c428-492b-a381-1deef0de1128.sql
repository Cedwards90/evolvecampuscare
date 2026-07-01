-- Ensure authors can always see their own case notes (survives reassignment + org suspension)
DROP POLICY IF EXISTS "Authors always see their own notes" ON public.file_notes;
CREATE POLICY "Authors always see their own notes"
  ON public.file_notes FOR SELECT
  USING (author_id = auth.uid());

-- Enable realtime for cross-tab freshness
ALTER TABLE public.file_notes REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'file_notes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.file_notes';
  END IF;
END $$;