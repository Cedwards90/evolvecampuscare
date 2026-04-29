REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;