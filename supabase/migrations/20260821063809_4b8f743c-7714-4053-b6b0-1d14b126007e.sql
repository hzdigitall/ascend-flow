CREATE OR REPLACE FUNCTION public.credit_points(
  _user uuid,
  _points bigint,
  _cat text,
  _desc text DEFAULT NULL::text,
  _ref uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE after_v BIGINT;
BEGIN
  IF _points = 0 THEN RETURN; END IF;
  UPDATE public.wallets SET points_balance = points_balance + _points, updated_at = now()
    WHERE user_id = _user RETURNING points_balance INTO after_v;
  INSERT INTO public.points_transactions (user_id, direction, points, balance_after, category, description, reference_id)
  VALUES (_user, (CASE WHEN _points > 0 THEN 'in' ELSE 'out' END)::tx_direction, abs(_points), after_v, _cat, _desc, _ref);
END;
$$;