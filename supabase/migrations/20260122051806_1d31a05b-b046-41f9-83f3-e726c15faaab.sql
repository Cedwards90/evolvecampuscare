-- Fix the overly permissive INSERT policy for notifications
-- The insert should be restricted to service role or edge functions
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches the authenticated user (for self-notifications)
-- or via service role (edge functions will use service role)
CREATE POLICY "Users can create notifications for themselves"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);