-- Create site_settings table for storing global configuration
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can modify settings
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read settings (needed for edge functions)
CREATE POLICY "Authenticated users can view settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (true);

-- Insert default notification settings
INSERT INTO public.site_settings (key, value) VALUES (
  'notifications',
  '{
    "email_enabled": true,
    "in_app_enabled": true,
    "types": {
      "new_request": true,
      "status_change": true,
      "assignment": true,
      "invitation": true,
      "weekly_summary": true
    }
  }'::jsonb
);