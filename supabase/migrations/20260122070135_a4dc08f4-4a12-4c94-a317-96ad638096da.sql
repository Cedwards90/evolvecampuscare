-- Add optional profile fields for enhanced student profile
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS student_id text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS year_of_study text,
ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'email';