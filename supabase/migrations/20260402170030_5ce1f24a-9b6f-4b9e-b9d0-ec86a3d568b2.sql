-- Add organization_id to user_invitations
ALTER TABLE public.user_invitations
ADD COLUMN organization_id uuid REFERENCES public.training_organizations(id) ON DELETE SET NULL;

-- Create organization_memberships table
CREATE TABLE public.organization_memberships (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.training_organizations(id) ON DELETE CASCADE,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    left_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all memberships"
ON public.organization_memberships
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (true);

-- Index for fast lookups
CREATE INDEX idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_active ON public.organization_memberships(organization_id) WHERE left_at IS NULL;

-- Update handle_invited_signup to set organization on profile
CREATE OR REPLACE FUNCTION public.handle_invited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    invitation_record RECORD;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT * INTO invitation_record
    FROM public.user_invitations
    WHERE email = NEW.email
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Update user role to invited role (replace default student role)
        UPDATE public.user_roles 
        SET role = invitation_record.invited_role
        WHERE user_id = NEW.id;
        
        -- Mark invitation as accepted
        UPDATE public.user_invitations
        SET accepted_at = now()
        WHERE id = invitation_record.id;
        
        -- If organization_id is set, assign user to org
        IF invitation_record.organization_id IS NOT NULL THEN
            UPDATE public.profiles
            SET organization_id = invitation_record.organization_id
            WHERE user_id = NEW.id;
            
            -- Create membership record
            INSERT INTO public.organization_memberships (user_id, organization_id, joined_at)
            VALUES (NEW.id, invitation_record.organization_id, now());
        END IF;
        
        -- If auto-assign case manager is set, create the assignment
        IF invitation_record.auto_assign_case_manager IS NOT NULL THEN
            INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
            VALUES (NEW.id, invitation_record.auto_assign_case_manager, invitation_record.invited_by, 'Auto-assigned via invitation');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;