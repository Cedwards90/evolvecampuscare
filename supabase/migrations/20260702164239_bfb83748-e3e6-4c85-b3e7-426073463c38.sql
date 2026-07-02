
-- appointment_blackouts: scope SELECT
DROP POLICY IF EXISTS "Auth users can read blackouts" ON public.appointment_blackouts;
CREATE POLICY "Scoped read blackouts" ON public.appointment_blackouts
FOR SELECT TO authenticated
USING (
  case_manager_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), case_manager_id))
  OR public.cm_has_assignment(case_manager_id, auth.uid())
);

-- certification_catalog: global entries visible to all; org-specific only to same org
DROP POLICY IF EXISTS "Authenticated can view catalog" ON public.certification_catalog;
CREATE POLICY "Scoped read catalog" ON public.certification_catalog
FOR SELECT TO authenticated
USING (
  organization_id IS NULL
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR organization_id = public.get_user_org(auth.uid())
  OR (public.is_org_admin(auth.uid()) AND public.is_org_admin_of(auth.uid(), organization_id))
);

-- impact_survey_templates: staff only
DROP POLICY IF EXISTS "Authenticated view templates" ON public.impact_survey_templates;
CREATE POLICY "Staff view templates" ON public.impact_survey_templates
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'case_manager'::app_role)
  OR public.is_org_admin(auth.uid())
);

-- nda_documents: non-admins only see current version
DROP POLICY IF EXISTS "Authenticated users can view NDA documents" ON public.nda_documents;
CREATE POLICY "Users view current NDA" ON public.nda_documents
FOR SELECT TO authenticated
USING (
  is_current = true
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- site_settings: staff only
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.site_settings;
CREATE POLICY "Staff view settings" ON public.site_settings
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'case_manager'::app_role)
  OR public.is_org_admin(auth.uid())
);
