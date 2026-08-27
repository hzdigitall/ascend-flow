REVOKE ALL ON FUNCTION public.expire_due_plans(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_expiring_plans(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_plans(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_expiring_plans(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_plan(uuid) TO service_role;