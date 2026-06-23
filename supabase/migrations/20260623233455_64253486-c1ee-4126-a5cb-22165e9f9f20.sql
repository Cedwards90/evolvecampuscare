
-- 1. Case-insensitive signup trigger
CREATE OR REPLACE FUNCTION public.handle_invited_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    invitation_record RECORD;
    v_email text := lower(trim(NEW.email));
BEGIN
    SELECT * INTO invitation_record
    FROM public.user_invitations
    WHERE lower(email) = v_email
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.user_roles
        SET role = invitation_record.invited_role
        WHERE user_id = NEW.id;

        IF invitation_record.organization_id IS NOT NULL THEN
            UPDATE public.profiles
            SET organization_id = invitation_record.organization_id
            WHERE user_id = NEW.id;

            INSERT INTO public.organization_memberships (user_id, organization_id, joined_at)
            VALUES (NEW.id, invitation_record.organization_id, now())
            ON CONFLICT DO NOTHING;
        END IF;

        IF invitation_record.auto_assign_case_manager IS NOT NULL THEN
            INSERT INTO public.student_assignments (student_id, case_manager_id, assigned_by, notes)
            VALUES (NEW.id, invitation_record.auto_assign_case_manager, invitation_record.invited_by, 'Auto-assigned via invitation')
            ON CONFLICT DO NOTHING;
        END IF;

        UPDATE public.user_invitations
        SET accepted_at = now()
        WHERE lower(email) = v_email
          AND accepted_at IS NULL
          AND expires_at > now();
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Normalize email on insert/update of user_invitations
CREATE OR REPLACE FUNCTION public.normalize_invitation_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_invitation_email_trg ON public.user_invitations;
CREATE TRIGGER normalize_invitation_email_trg
BEFORE INSERT OR UPDATE ON public.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.normalize_invitation_email();

-- 3. Backfill: lowercase existing invitation emails
UPDATE public.user_invitations
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- 4. Backfill: mark pending invitations accepted for users who already signed up
UPDATE public.user_invitations ui
SET accepted_at = now()
WHERE ui.accepted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(ui.email)
      AND u.confirmed_at IS NOT NULL
  );
