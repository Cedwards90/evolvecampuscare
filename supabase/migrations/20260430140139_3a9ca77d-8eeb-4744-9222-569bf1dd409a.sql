-- 1. Fix handle_invited_signup so all duplicate pending invitations for the
--    same email are marked accepted, not only the most recent one.
CREATE OR REPLACE FUNCTION public.handle_invited_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    invitation_record RECORD;
BEGIN
    -- Use the most recent pending invitation for side-effects (role/org/assignment)
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

        -- If organization_id is set, assign user to org
        IF invitation_record.organization_id IS NOT NULL THEN
            UPDATE public.profiles
            SET organization_id = invitation_record.organization_id
            WHERE user_id = NEW.id;

            INSERT INTO public.organization_memberships (user_id, organization_id, joined_at)
            VALUES (NEW.id, invitation_record.organization_id, now());
        END IF;

        -- If auto-assign case manager is set, create the assignment
        IF invitation_record.auto_assign_case_manager IS NOT NULL THEN
            INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
            VALUES (NEW.id, invitation_record.auto_assign_case_manager, invitation_record.invited_by, 'Auto-assigned via invitation');
        END IF;

        -- Mark ALL pending non-expired invitations for this email as accepted,
        -- so older duplicates do not stay stuck in the pending list.
        UPDATE public.user_invitations
        SET accepted_at = now()
        WHERE email = NEW.email
          AND accepted_at IS NULL
          AND expires_at > now();
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. One-time backfill: any pending invitation whose email already exists in
--    profiles (i.e. the user already signed up) should be marked accepted.
UPDATE public.user_invitations ui
SET accepted_at = now()
WHERE ui.accepted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.email = ui.email);

-- 3. Enable realtime on user_invitations so the UI updates the moment the
--    trigger flips accepted_at.
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_invitations;