ALTER TABLE public.student_files
  ADD COLUMN IF NOT EXISTS cmf_identified_needs int[] NOT NULL DEFAULT '{}';