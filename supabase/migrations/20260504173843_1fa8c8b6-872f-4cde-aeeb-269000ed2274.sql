
DROP POLICY IF EXISTS "Authenticated users can view active qr codes" ON public.qr_codes;
CREATE POLICY "Anyone can view active qr codes"
ON public.qr_codes
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Users can insert their own scan events" ON public.qr_scan_events;
CREATE POLICY "Anyone can insert scan events"
ON public.qr_scan_events
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
