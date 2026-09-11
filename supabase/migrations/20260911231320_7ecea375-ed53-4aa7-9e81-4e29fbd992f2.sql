CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _title text,
  _message text,
  _type text,
  _link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_actor <> _user_id AND NOT public.can_staff_manage_student(v_actor, _user_id) THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (_user_id, _title, _message, _type, _link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) TO authenticated, service_role;