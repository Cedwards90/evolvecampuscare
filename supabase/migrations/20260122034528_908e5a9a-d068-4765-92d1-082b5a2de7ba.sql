-- Create user_invitations table for admin/case manager invitations
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_role app_role NOT NULL,
    invited_by UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    auto_assign_case_manager UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage all invitations
CREATE POLICY "Admins can manage all invitations"
ON public.user_invitations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Case managers can view their own invitations
CREATE POLICY "Case managers can view their invitations"
ON public.user_invitations
FOR SELECT
USING (
    has_role(auth.uid(), 'case_manager'::app_role) 
    AND invited_by = auth.uid()
);

-- Case managers can create student invitations only
CREATE POLICY "Case managers can invite students"
ON public.user_invitations
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'case_manager'::app_role) 
    AND invited_role = 'student'::app_role
    AND invited_by = auth.uid()
);

-- Add trigger for updated_at
CREATE TRIGGER update_user_invitations_updated_at
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle invited user signup - override default student role
CREATE OR REPLACE FUNCTION public.handle_invited_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        
        -- If auto-assign case manager is set, create the assignment
        IF invitation_record.auto_assign_case_manager IS NOT NULL THEN
            INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
            VALUES (NEW.id, invitation_record.auto_assign_case_manager, invitation_record.invited_by, 'Auto-assigned via invitation');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users to handle invited signups
-- Note: This trigger runs AFTER the handle_new_user trigger
CREATE TRIGGER on_invited_user_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_invited_signup();