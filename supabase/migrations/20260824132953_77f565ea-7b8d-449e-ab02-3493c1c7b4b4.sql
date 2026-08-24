REVOKE ALL ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) TO service_role;