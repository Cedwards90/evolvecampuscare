CREATE TABLE public.data_export_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL,
  tables text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  include_sensitive boolean NOT NULL DEFAULT false,
  row_count integer NOT NULL DEFAULT 0,
  format text NOT NULL DEFAULT 'csv',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.data_export_audit TO authenticated;
GRANT ALL ON public.data_export_audit TO service_role;

ALTER TABLE public.data_export_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view export audit"
ON public.data_export_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can view their own export audit"
ON public.data_export_audit FOR SELECT TO authenticated
USING (public.is_org_admin(auth.uid()) AND actor_id = auth.uid());

CREATE INDEX idx_data_export_audit_created_at ON public.data_export_audit (created_at DESC);