-- Create student_files table
CREATE TABLE public.student_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  intake_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_files ENABLE ROW LEVEL SECURITY;

-- Students see own file
CREATE POLICY "Students can view own file"
ON public.student_files FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Students can update own file
CREATE POLICY "Students can update own file"
ON public.student_files FOR UPDATE
TO authenticated
USING (auth.uid() = student_id);

-- Case managers see assigned students' files
CREATE POLICY "Case managers can view assigned student files"
ON public.student_files FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager') AND
  EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = student_files.student_id
  )
);

-- Admins see all
CREATE POLICY "Admins can view all student files"
ON public.student_files FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all student files"
ON public.student_files FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_student_files_updated_at
BEFORE UPDATE ON public.student_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create intake_responses table
CREATE TABLE public.intake_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  section text NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_responses ENABLE ROW LEVEL SECURITY;

-- Students can view and create own responses
CREATE POLICY "Students can view own intake responses"
ON public.intake_responses FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students can create own intake responses"
ON public.intake_responses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Case managers see assigned students' responses
CREATE POLICY "Case managers can view assigned student intake"
ON public.intake_responses FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager') AND
  EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = intake_responses.student_id
  )
);

-- Admins see all
CREATE POLICY "Admins can view all intake responses"
ON public.intake_responses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create file_notes table
CREATE TABLE public.file_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.file_notes ENABLE ROW LEVEL SECURITY;

-- Students can view notes on their file
CREATE POLICY "Students can view own file notes"
ON public.file_notes FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Case managers can view and add notes for assigned students
CREATE POLICY "Case managers can view assigned student notes"
ON public.file_notes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager') AND
  EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id
  )
);

CREATE POLICY "Case managers can add notes for assigned students"
ON public.file_notes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id AND
  has_role(auth.uid(), 'case_manager') AND
  EXISTS (
    SELECT 1 FROM public.student_assignments sa
    WHERE sa.case_manager_id = auth.uid() AND sa.student_id = file_notes.student_id
  )
);

-- Admins can do everything with notes
CREATE POLICY "Admins can manage all file notes"
ON public.file_notes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update handle_new_user to also create student_files entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Create profile for new user
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    -- Assign default student role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student');
    
    -- Create student file
    INSERT INTO public.student_files (student_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;