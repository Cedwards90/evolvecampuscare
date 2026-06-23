
-- 1. Add cohort_id to user_invitations
ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_invitations_cohort_idx
  ON public.user_invitations(cohort_id) WHERE cohort_id IS NOT NULL;

-- 2. Validation trigger: ensure cohort belongs to invitation's organization (when both set)
CREATE OR REPLACE FUNCTION public.validate_invitation_cohort()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.cohort_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.cohorts WHERE id = NEW.cohort_id;
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'Cohort % not found', NEW.cohort_id;
    END IF;
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := v_org;
    ELSIF NEW.organization_id <> v_org THEN
      RAISE EXCEPTION 'Cohort does not belong to invitation organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_invitation_cohort_trg ON public.user_invitations;
CREATE TRIGGER validate_invitation_cohort_trg
BEFORE INSERT OR UPDATE ON public.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.validate_invitation_cohort();

-- 3. Update handle_invited_signup to apply cohort_id from the invitation
CREATE OR REPLACE FUNCTION public.handle_invited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

        IF invitation_record.cohort_id IS NOT NULL THEN
            UPDATE public.profiles
            SET cohort_id = invitation_record.cohort_id
            WHERE user_id = NEW.id;
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
$$;

-- 4. Backfill: Dominic Heath -> Cohort 3
UPDATE public.profiles
SET cohort_id = 'e7905562-1ee1-4342-8111-12d947a129e7'
WHERE user_id = '07fd39f8-75a7-47ce-b50f-4382a85a594b'
  AND cohort_id IS NULL;
