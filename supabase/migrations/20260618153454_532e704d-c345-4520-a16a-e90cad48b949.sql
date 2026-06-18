
DROP POLICY IF EXISTS "Service role manages MFA exemption audit" ON public.mfa_exemption_audit;

DROP POLICY IF EXISTS "Audit inserts by system" ON public.time_entry_audit;
CREATE POLICY "Users can insert their own audit rows"
ON public.time_entry_audit
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());
