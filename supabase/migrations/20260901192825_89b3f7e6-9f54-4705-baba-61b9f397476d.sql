REVOKE EXECUTE ON FUNCTION public.qualified_rank_level(uuid, date) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_career_points(_admin uuid, _user uuid, _period date, _points bigint, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM _admin OR NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.career_monthly_points (user_id, period, points)
  VALUES (_user, _period, GREATEST(_points, 0))
  ON CONFLICT (user_id, period) DO UPDATE SET points = GREATEST(_points, 0), updated_at = now();
  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'bla_points_set', 'career_monthly_points', _user,
          jsonb_build_object('period', _period, 'points', _points, 'reason', _reason));
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_career_rank(_admin uuid, _user uuid, _level integer, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rk record;
BEGIN
  IF auth.uid() IS DISTINCT FROM _admin OR NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO rk FROM public.career_ranks WHERE level = _level;
  INSERT INTO public.user_career (user_id, rank_level, rank_name, achieved_at)
  VALUES (_user, COALESCE(_level, 0), rk.name, now())
  ON CONFLICT (user_id) DO UPDATE SET rank_level = EXCLUDED.rank_level,
    rank_name = EXCLUDED.rank_name, achieved_at = now(), updated_at = now();
  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'bla_rank_set', 'user_career', _user,
          jsonb_build_object('level', _level, 'reason', _reason));
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_run_bla(_admin uuid, _period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM _admin OR NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  n := public.process_monthly_bla(_period);
  INSERT INTO public.admin_logs (admin_id, action, table_name, new_value)
  VALUES (_admin, 'bla_run', 'bla_payouts', jsonb_build_object('period', _period, 'processed', n));
  RETURN n;
END; $$;