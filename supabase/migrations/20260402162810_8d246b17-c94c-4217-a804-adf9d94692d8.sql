-- Create training_organizations table
CREATE TABLE public.training_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  contact_name text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_organizations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active orgs
CREATE POLICY "Authenticated users can view orgs"
  ON public.training_organizations
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage orgs (insert, update, delete)
CREATE POLICY "Admins can manage orgs"
  ON public.training_organizations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_training_organizations_updated_at
  BEFORE UPDATE ON public.training_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add organization_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN organization_id uuid REFERENCES public.training_organizations(id);