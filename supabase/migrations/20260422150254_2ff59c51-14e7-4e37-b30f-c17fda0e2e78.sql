ALTER TABLE public.survey_invitations
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS email_status text NULL,
  ADD COLUMN IF NOT EXISTS email_error text NULL;