
-- Close older duplicate open invitations, keep newest per (student, survey_type)
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id, survey_type ORDER BY created_at DESC, id DESC) AS rn
  FROM public.survey_invitations
  WHERE completed_at IS NULL
)
UPDATE public.survey_invitations si
SET completed_at = now(),
    notes = COALESCE(si.notes, '') || ' [auto-closed duplicate]'
FROM ranked r
WHERE si.id = r.id AND r.rn > 1;

-- Prevent future duplicates: only one OPEN invitation per (student, survey_type)
CREATE UNIQUE INDEX IF NOT EXISTS survey_invitations_one_open_per_type
  ON public.survey_invitations (student_id, survey_type)
  WHERE completed_at IS NULL;
