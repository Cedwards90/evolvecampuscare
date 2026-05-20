
-- 1. participant_outcomes
CREATE TABLE public.participant_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  employment_status text,
  job_title text,
  employer text,
  placement_date date,
  hourly_wage numeric(10,2),
  weekly_hours numeric(5,2),
  baseline_wage numeric(10,2),
  retention_30_met boolean DEFAULT false,
  retention_30_date date,
  retention_60_met boolean DEFAULT false,
  retention_60_date date,
  retention_90_met boolean DEFAULT false,
  retention_90_date date,
  retention_180_met boolean DEFAULT false,
  retention_180_date date,
  retention_365_met boolean DEFAULT false,
  retention_365_date date,
  program_completed boolean DEFAULT false,
  program_completion_date date,
  completion_reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own outcomes" ON public.participant_outcomes
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Staff view outcomes" ON public.participant_outcomes
  FOR SELECT TO authenticated USING (public.can_staff_manage_student(auth.uid(), student_id));
CREATE POLICY "Staff insert outcomes" ON public.participant_outcomes
  FOR INSERT TO authenticated WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));
CREATE POLICY "Staff update outcomes" ON public.participant_outcomes
  FOR UPDATE TO authenticated USING (public.can_staff_manage_student(auth.uid(), student_id))
  WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));
CREATE TRIGGER po_updated_at BEFORE UPDATE ON public.participant_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. impact_survey_templates
CREATE TABLE public.impact_survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  cadence_days integer NOT NULL DEFAULT 90,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_survey_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view templates" ON public.impact_survey_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.impact_survey_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER ist_updated_at BEFORE UPDATE ON public.impact_survey_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. impact_survey_responses
CREATE TABLE public.impact_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.impact_survey_templates(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_isr_student ON public.impact_survey_responses(student_id);
CREATE INDEX idx_isr_template ON public.impact_survey_responses(template_id);
CREATE POLICY "Students manage own responses" ON public.impact_survey_responses
  FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Staff view responses" ON public.impact_survey_responses
  FOR SELECT TO authenticated USING (public.can_staff_manage_student(auth.uid(), student_id));

-- 4. impact_survey_assignments
CREATE TABLE public.impact_survey_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.impact_survey_templates(id) ON DELETE CASCADE,
  next_due_at timestamptz NOT NULL DEFAULT now(),
  last_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, template_id)
);
ALTER TABLE public.impact_survey_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own assignments" ON public.impact_survey_assignments
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Staff view assignments" ON public.impact_survey_assignments
  FOR SELECT TO authenticated USING (public.can_staff_manage_student(auth.uid(), student_id));
CREATE POLICY "Admins manage assignments" ON public.impact_survey_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. participant_demographics
CREATE TABLE public.participant_demographics (
  student_id uuid PRIMARY KEY,
  gender text,
  age_range text,
  ethnicity text[],
  veteran_status boolean,
  justice_involved boolean,
  disability_status boolean,
  consent_at timestamptz NOT NULL,
  consent_version text NOT NULL DEFAULT '1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_demographics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own demographics" ON public.participant_demographics
  FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Staff view demographics" ON public.participant_demographics
  FOR SELECT TO authenticated USING (public.can_staff_manage_student(auth.uid(), student_id));
CREATE TRIGGER pd_updated_at BEFORE UPDATE ON public.participant_demographics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. funding_goals
CREATE TABLE public.funding_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title text NOT NULL,
  description text,
  metric_key text NOT NULL,
  target_value numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view goals" ON public.funding_goals
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'case_manager'::app_role)
    OR (public.is_org_admin(auth.uid()) AND (organization_id IS NULL OR public.is_org_admin_of(auth.uid(), organization_id)))
  );
CREATE POLICY "Admins manage all goals" ON public.funding_goals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Org admins manage org goals" ON public.funding_goals
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid()) AND organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), organization_id));
CREATE TRIGGER fg_updated_at BEFORE UPDATE ON public.funding_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. donor_report_templates
CREATE TABLE public.donor_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donor_report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view donor templates" ON public.donor_report_templates
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'case_manager'::app_role)
    OR public.is_org_admin(auth.uid())
  );
CREATE POLICY "Admins manage donor templates" ON public.donor_report_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER drt_updated_at BEFORE UPDATE ON public.donor_report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. impact_report_audit
CREATE TABLE public.impact_report_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  format text NOT NULL,
  template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_report_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff insert own audit" ON public.impact_report_audit
  FOR INSERT TO authenticated WITH CHECK (
    actor_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'case_manager'::app_role)
      OR public.is_org_admin(auth.uid()))
  );
CREATE POLICY "Staff view audit" ON public.impact_report_audit
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.is_org_admin(auth.uid())
    OR actor_id = auth.uid()
  );

-- Seed built-in templates
INSERT INTO public.impact_survey_templates (slug, title, description, cadence_days, is_builtin, questions) VALUES
('housing_stability','Housing Stability','Track stable housing access',90,true,
 '[{"key":"stable_housing","label":"I have stable housing","type":"likert"},{"key":"housing_risk","label":"I am at risk of losing my housing","type":"likert_negative"},{"key":"housing_notes","label":"Additional context (optional)","type":"text"}]'::jsonb),
('transportation_access','Transportation Access','Reliable transportation to work/school',90,true,
 '[{"key":"reliable_transport","label":"I have reliable transportation","type":"likert"},{"key":"transport_barrier","label":"Transportation prevented me from attending events recently","type":"likert_negative"}]'::jsonb),
('digital_literacy','Digital Literacy','Comfort with technology and digital tools',180,true,
 '[{"key":"computer_comfort","label":"I am comfortable using a computer for work","type":"likert"},{"key":"online_apps","label":"I can complete online forms and applications","type":"likert"},{"key":"email_use","label":"I use email regularly","type":"likert"}]'::jsonb),
('confidence_self_efficacy','Confidence & Self-Efficacy','Self-belief and goal pursuit',90,true,
 '[{"key":"goal_confidence","label":"I am confident I can achieve my goals","type":"likert"},{"key":"obstacle_handling","label":"I can handle setbacks","type":"likert"},{"key":"future_optimism","label":"I am optimistic about my future","type":"likert"}]'::jsonb),
('mentorship_participation','Mentorship Participation','Mentor engagement',90,true,
 '[{"key":"has_mentor","label":"I currently have a mentor","type":"boolean"},{"key":"mentor_meetings_30d","label":"Times I met with my mentor in the last 30 days","type":"number"}]'::jsonb),
('community_engagement','Community Engagement','Connection with community',90,true,
 '[{"key":"community_events","label":"I participated in community events recently","type":"likert"},{"key":"volunteer","label":"I volunteered in the last 90 days","type":"boolean"}]'::jsonb),
('recidivism_check','Recidivism Check','Justice involvement update (self-report)',180,true,
 '[{"key":"new_involvement","label":"I have had new justice-system involvement since my last response","type":"boolean"}]'::jsonb),
('career_progression','Career Progression','Long-term career trajectory',180,true,
 '[{"key":"promotion","label":"I received a promotion or raise in the last 6 months","type":"boolean"},{"key":"new_skills","label":"I learned new job-relevant skills","type":"likert"},{"key":"career_satisfaction","label":"I am satisfied with my career progress","type":"likert"}]'::jsonb);
