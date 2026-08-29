CREATE OR REPLACE FUNCTION public.get_my_network()
RETURNS TABLE (
  id uuid,
  level int,
  created_at timestamptz,
  referred_id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.level, r.created_at, r.referred_id, p.full_name, p.email, p.phone
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.sponsor_id = auth.uid()
  ORDER BY r.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_network() TO authenticated;