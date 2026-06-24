
CREATE TABLE public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  signed_in_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_user_time ON public.user_login_events(user_id, signed_in_at DESC);
CREATE INDEX idx_login_events_time ON public.user_login_events(signed_in_at DESC);

GRANT SELECT, INSERT ON public.user_login_events TO authenticated;
GRANT ALL ON public.user_login_events TO service_role;

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own login events"
  ON public.user_login_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all login events"
  ON public.user_login_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can view scoped login events"
  ON public.user_login_events FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.user_in_org_admin_scope_v2(auth.uid(), user_id));

CREATE POLICY "Users can view their own login events"
  ON public.user_login_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Backfill historical sign-in data from auth.users (one row per user)
INSERT INTO public.user_login_events (user_id, signed_in_at, source)
SELECT id, last_sign_in_at, 'backfill'
FROM auth.users
WHERE last_sign_in_at IS NOT NULL;
