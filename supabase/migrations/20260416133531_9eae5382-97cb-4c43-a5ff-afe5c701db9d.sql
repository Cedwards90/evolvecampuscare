-- 1. Fix notifications INSERT policy: restrict to own user_id only
DROP POLICY IF EXISTS "Users can create notifications for themselves" ON public.notifications;
CREATE POLICY "Users can create notifications for themselves"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Fix organization_memberships SELECT policy: restrict from public to scoped
DROP POLICY IF EXISTS "Authenticated users can view memberships" ON public.organization_memberships;

CREATE POLICY "Users can view own memberships"
  ON public.organization_memberships FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'case_manager'::app_role)
  );

-- 3. Fix request_updates INSERT policy: verify user is a participant
DROP POLICY IF EXISTS "Authenticated users can create updates" ON public.request_updates;

CREATE POLICY "Participants can create request updates"
  ON public.request_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM support_requests sr
        WHERE sr.id = request_updates.request_id
        AND (
          sr.student_id = auth.uid()
          OR sr.assigned_case_manager_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
        )
      )
    )
  );