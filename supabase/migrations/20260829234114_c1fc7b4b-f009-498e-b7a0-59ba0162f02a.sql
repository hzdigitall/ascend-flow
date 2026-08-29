DROP FUNCTION IF EXISTS public.get_my_network();

CREATE OR REPLACE FUNCTION public.get_my_network()
RETURNS TABLE(
  id uuid,
  level integer,
  created_at timestamptz,
  referred_id uuid,
  full_name text,
  email text,
  phone text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    r.id,
    r.level,
    r.created_at,
    r.referred_id,
    p.full_name,
    p.email,
    p.phone,
    EXISTS (
      SELECT 1 FROM public.user_plans up
      WHERE up.user_id = r.referred_id
        AND up.status = 'active'
        AND (up.expires_at IS NULL OR up.expires_at > now())
    ) AS is_active
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.sponsor_id = auth.uid()
  ORDER BY r.level, r.created_at DESC;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_my_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_network() TO authenticated;