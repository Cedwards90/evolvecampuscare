
CREATE TABLE public.user_filter_preferences (
  user_id uuid PRIMARY KEY,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own filter prefs"
  ON public.user_filter_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own filter prefs"
  ON public.user_filter_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own filter prefs"
  ON public.user_filter_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own filter prefs"
  ON public.user_filter_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
