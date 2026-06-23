
-- Org admins can read bulk invite jobs they created or in their org scope
CREATE POLICY "Org admins read own bulk invite jobs"
ON public.bulk_invite_jobs
FOR SELECT
TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND (
    created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), organization_id))
  )
);

-- Org admins can read items of jobs they own / in their org scope
CREATE POLICY "Org admins read own bulk invite job items"
ON public.bulk_invite_job_items
FOR SELECT
TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.bulk_invite_jobs j
    WHERE j.id = bulk_invite_job_items.job_id
      AND (
        j.created_by = auth.uid()
        OR (j.organization_id IS NOT NULL AND public.is_org_admin_of(auth.uid(), j.organization_id))
      )
  )
);

-- Allow service role to insert into participant-exports bucket (server-side export generation)
CREATE POLICY "Service role inserts participant exports"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'participant-exports');
