ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cmf_preferred_contact_type text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Treat all existing users as already onboarded so we don't lock anyone out
UPDATE public.profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL;