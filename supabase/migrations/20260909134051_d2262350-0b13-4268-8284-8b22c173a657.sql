REVOKE EXECUTE ON FUNCTION public.enforce_request_controls() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_request_delete() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_request_update_delete() FROM authenticated;