-- 1) Restrict profiles read to self + admins
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- 2) Expose only non-sensitive sponsor contact fields
CREATE OR REPLACE FUNCTION public.get_my_sponsor()
RETURNS TABLE (full_name text, phone text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.full_name, s.phone, s.avatar_url
  FROM public.profiles me
  JOIN public.profiles s ON s.id = me.sponsor_id
  WHERE me.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_sponsor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sponsor() TO authenticated, service_role;

-- 3) redeem_product is only invoked server-side with elevated privileges;
-- remove direct access for signed-in users and enforce caller ownership.
REVOKE ALL ON FUNCTION public.redeem_product(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_product(uuid, uuid, jsonb) TO service_role;