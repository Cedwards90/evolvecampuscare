-- Create student_assignments table for persistent student-case manager relationships
CREATE TABLE public.student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    case_manager_id UUID NOT NULL,
    assigned_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (student_id) -- Each student has exactly one primary case manager
);

-- Enable RLS
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all assignments
CREATE POLICY "Admins can manage student assignments"
ON public.student_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Case managers can view their assigned students
CREATE POLICY "Case managers can view their students"
ON public.student_assignments FOR SELECT
USING (case_manager_id = auth.uid() AND has_role(auth.uid(), 'case_manager'::app_role));

-- Students can view their own assignment
CREATE POLICY "Students can view their assignment"
ON public.student_assignments FOR SELECT
USING (student_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_student_assignments_updated_at
BEFORE UPDATE ON public.student_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();