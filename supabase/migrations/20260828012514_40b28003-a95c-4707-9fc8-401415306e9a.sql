-- Restrict payment gateway config reads to admins only
DROP POLICY IF EXISTS gateways_select_auth ON public.payment_gateways;
CREATE POLICY gateways_select_admin ON public.payment_gateways
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Trigger functions must not be callable via the API
REVOKE ALL ON FUNCTION public.log_user_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Internal rate helper is only used by trusted server code
REVOKE EXECUTE ON FUNCTION public.usdt_brl_rate() FROM anon, authenticated;