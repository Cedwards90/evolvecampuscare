
CREATE TABLE public.post_graduation_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  graduation_date DATE,
  career_goals TEXT NOT NULL DEFAULT '',
  education_goals TEXT NOT NULL DEFAULT '',
  housing_plan TEXT NOT NULL DEFAULT '',
  financial_plan TEXT NOT NULL DEFAULT '',
  health_wellness TEXT NOT NULL DEFAULT '',
  support_needed TEXT NOT NULL DEFAULT '',
  month_1_3_actions TEXT NOT NULL DEFAULT '',
  month_4_6_actions TEXT NOT NULL DEFAULT '',
  month_7_9_actions TEXT NOT NULL DEFAULT '',
  month_10_12_actions TEXT NOT NULL DEFAULT '',
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_graduation_plans ENABLE ROW LEVEL SECURITY;

-- Students can insert their own plans
CREATE POLICY "Students can insert own plans"
ON public.post_graduation_plans
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Students can view their own plans
CREATE POLICY "Students can view own plans"
ON public.post_graduation_plans
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Case managers can view assigned students' plans
CREATE POLICY "Case managers can view assigned student plans"
ON public.post_graduation_plans
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'case_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM student_assignments sa
    WHERE sa.case_manager_id = auth.uid()
      AND sa.student_id = post_graduation_plans.student_id
  )
);

-- Admins can view all plans
CREATE POLICY "Admins can view all plans"
ON public.post_graduation_plans
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_post_graduation_plans_updated_at
BEFORE UPDATE ON public.post_graduation_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
