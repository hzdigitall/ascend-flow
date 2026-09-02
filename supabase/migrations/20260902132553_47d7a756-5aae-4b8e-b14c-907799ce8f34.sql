REVOKE EXECUTE ON FUNCTION public.process_daily_roi() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_grant_plan(uuid, uuid, uuid, text) FROM anon, authenticated;