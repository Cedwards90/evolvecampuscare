
-- Revoke public/anon access from SECURITY DEFINER functions that should not be callable by unauthenticated users or directly via the API.

-- Trigger-only functions: no role should call them directly
REVOKE EXECUTE ON FUNCTION public.sync_cohort_case_manager_assignments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_cohort_assignments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_organization() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_time_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_time_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_invited_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Org/role helpers: remove anon (PUBLIC) execute; keep authenticated for RLS usage
REVOKE EXECUTE ON FUNCTION public.get_user_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_admin_sees_user(uuid, uuid) FROM PUBLIC, anon;

-- pgmq wrappers: already restricted, ensure no anon/authenticated access
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
