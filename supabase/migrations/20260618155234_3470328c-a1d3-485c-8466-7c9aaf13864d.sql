-- Centralize assignment-based case manager access so folder policies do not
-- repeatedly query student_assignments through nested RLS.
CREATE OR REPLACE FUNCTION public.cm_can_access_student(_actor uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_actor, 'case_manager'::app_role)
    AND public.cm_has_assignment(_actor, _student)
    AND NOT public.is_user_org_suspended(_student);
$$;

REVOKE EXECUTE ON FUNCTION public.cm_can_access_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cm_can_access_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cm_can_access_student(uuid, uuid) TO service_role;

-- Keep staff-folder access centralized and avoid direct policy recursion paths.
CREATE OR REPLACE FUNCTION public.can_staff_manage_student(_actor uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_actor, 'admin'::app_role)
    OR public.cm_can_access_student(_actor, _student)
    OR (
      public.is_org_admin(_actor)
      AND NOT public.is_user_org_suspended(_student)
      AND public.user_in_org_admin_scope_v2(_actor, _student)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_staff_manage_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_staff_manage_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_staff_manage_student(uuid, uuid) TO service_role;

-- Student folder profile visibility for case managers.
DROP POLICY IF EXISTS "Case managers view assigned students" ON public.profiles;
CREATE POLICY "Case managers view assigned students"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), user_id));

-- Assignment list visibility for case managers.
DROP POLICY IF EXISTS "Case managers can view their students" ON public.student_assignments;
CREATE POLICY "Case managers can view their students"
ON public.student_assignments
FOR SELECT
TO authenticated
USING (
  case_manager_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
);

-- Student files.
DROP POLICY IF EXISTS "Case managers can view assigned student files" ON public.student_files;
CREATE POLICY "Case managers can view assigned student files"
ON public.student_files
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

-- Case notes.
DROP POLICY IF EXISTS "Case managers can view assigned student notes" ON public.file_notes;
CREATE POLICY "Case managers can view assigned student notes"
ON public.file_notes
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Case managers can add notes for assigned students" ON public.file_notes;
CREATE POLICY "Case managers can add notes for assigned students"
ON public.file_notes
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Case managers can update their own notes" ON public.file_notes;
CREATE POLICY "Case managers can update their own notes"
ON public.file_notes
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
)
WITH CHECK (
  author_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Case managers can delete their own notes" ON public.file_notes;
CREATE POLICY "Case managers can delete their own notes"
ON public.file_notes
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
);

-- Intake, check-ins, and plans shown in folders.
DROP POLICY IF EXISTS "Case managers can view assigned student intake" ON public.intake_responses;
CREATE POLICY "Case managers can view assigned student intake"
ON public.intake_responses
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Case managers can view assigned student check-ins" ON public.student_checkins;
CREATE POLICY "Case managers can view assigned student check-ins"
ON public.student_checkins
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Case managers can view assigned student plans" ON public.post_graduation_plans;
CREATE POLICY "Case managers can view assigned student plans"
ON public.post_graduation_plans
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

-- Appointments tied to assigned students.
DROP POLICY IF EXISTS "Case managers can create appointments" ON public.appointments;
CREATE POLICY "Case managers can create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = case_manager_id
  AND public.cm_can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Case managers can view their appointments" ON public.appointments;
CREATE POLICY "Case managers can view their appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  auth.uid() = case_manager_id
  AND public.cm_can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Participants can update appointments" ON public.appointments;
CREATE POLICY "Participants can update appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
  OR (
    auth.uid() = case_manager_id
    AND public.cm_can_access_student(auth.uid(), student_id)
  )
);

-- Support request visibility remains assigned-only for case managers.
DROP POLICY IF EXISTS "Case managers can view assigned requests" ON public.support_requests;
DROP POLICY IF EXISTS "Case managers can view requests assigned to them" ON public.support_requests;
CREATE POLICY "Case managers can view requests assigned to them"
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  assigned_case_manager_id = auth.uid()
  AND public.cm_can_access_student(auth.uid(), student_id)
);

-- Folder-related derived records that already call can_staff_manage_student now use the hardened helper.
DROP POLICY IF EXISTS "Staff view responses" ON public.impact_survey_responses;
CREATE POLICY "Staff view responses"
ON public.impact_survey_responses
FOR SELECT
TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Staff view student certs" ON public.student_certifications;
CREATE POLICY "Staff view student certs"
ON public.student_certifications
FOR SELECT
TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Staff insert student certs" ON public.student_certifications;
CREATE POLICY "Staff insert student certs"
ON public.student_certifications
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.can_staff_manage_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff update student certs" ON public.student_certifications;
CREATE POLICY "Staff update student certs"
ON public.student_certifications
FOR UPDATE
TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id))
WITH CHECK (public.can_staff_manage_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "Staff delete student certs" ON public.student_certifications;
CREATE POLICY "Staff delete student certs"
ON public.student_certifications
FOR DELETE
TO authenticated
USING (public.can_staff_manage_student(auth.uid(), student_id));

-- Transfer records surfaced from student folders.
DROP POLICY IF EXISTS "Case managers view transfers for assigned students" ON public.participant_transfers;
CREATE POLICY "Case managers view transfers for assigned students"
ON public.participant_transfers
FOR SELECT
TO authenticated
USING (public.cm_can_access_student(auth.uid(), student_id));

DROP POLICY IF EXISTS "View events on transfers I can see" ON public.participant_transfer_events;
CREATE POLICY "View events on transfers I can see"
ON public.participant_transfer_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.participant_transfers t
    WHERE t.id = participant_transfer_events.transfer_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
          public.is_org_admin(auth.uid())
          AND (
            (t.from_organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), t.from_organization_id))
            OR public.is_org_admin_of(auth.uid(), t.to_organization_id)
          )
        )
        OR public.cm_can_access_student(auth.uid(), t.student_id)
      )
  )
);

-- Security scan finding: case managers may only see memberships for assigned students.
DROP POLICY IF EXISTS "Users can view own memberships" ON public.organization_memberships;
CREATE POLICY "Users can view own memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.cm_can_access_student(auth.uid(), user_id)
);

-- Security scan finding: do not broadcast bearer share tokens through realtime.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'request_share_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.request_share_links;
  END IF;
END $$;