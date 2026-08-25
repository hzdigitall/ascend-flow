REVOKE ALL ON FUNCTION public.usdt_brl_rate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usdt_brl_rate() TO authenticated, service_role;