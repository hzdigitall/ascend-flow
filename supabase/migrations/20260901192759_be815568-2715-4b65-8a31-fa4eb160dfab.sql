-- ============ BLA: Bônus de Liderança Ativa ============

CREATE TABLE public.career_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level integer NOT NULL UNIQUE,
  points_required bigint NOT NULL,
  bonus numeric NOT NULL DEFAULT 0,
  required_rank_level integer,
  required_rank_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.career_ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_ranks TO authenticated;
GRANT ALL ON public.career_ranks TO service_role;
ALTER TABLE public.career_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "career_ranks_read" ON public.career_ranks FOR SELECT USING (true);
CREATE POLICY "career_ranks_admin_write" ON public.career_ranks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER career_ranks_updated_at BEFORE UPDATE ON public.career_ranks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.career_ranks (name, level, points_required, bonus, required_rank_level, required_rank_count) VALUES
  ('Master', 1, 500, 300, NULL, 0),
  ('Bronze', 2, 1000, 500, NULL, 0),
  ('Prata', 3, 2000, 800, 1, 2),
  ('Ouro', 4, 5000, 1300, 1, 4),
  ('Platina', 5, 10000, 2000, 3, 4),
  ('Diamante', 6, 20000, 3000, 3, 8),
  ('Duplo Diamante', 7, 40000, 4500, 4, 10),
  ('Triplo Diamante', 8, 80000, 6500, 6, 10),
  ('Imperial', 9, 160000, 9000, 7, 10),
  ('Embaixador', 10, 320000, 12000, 9, 5),
  ('Presidente', 11, 500000, 16000, 10, 2),
  ('Titan', 12, 1000000, 25000, 11, 1);

CREATE TABLE public.career_monthly_points (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period date NOT NULL,
  points bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);
GRANT SELECT ON public.career_monthly_points TO authenticated;
GRANT ALL ON public.career_monthly_points TO service_role;
ALTER TABLE public.career_monthly_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmp_own_or_admin" ON public.career_monthly_points FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE INDEX career_monthly_points_period_idx ON public.career_monthly_points (period);

CREATE TABLE public.user_career (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank_level integer NOT NULL DEFAULT 0,
  rank_name text,
  achieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_career TO authenticated;
GRANT ALL ON public.user_career TO service_role;
ALTER TABLE public.user_career ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_career_own_or_admin" ON public.user_career FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE public.bla_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period date NOT NULL,
  rank_level integer NOT NULL DEFAULT 0,
  rank_name text,
  points bigint NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
);
GRANT SELECT ON public.bla_payouts TO authenticated;
GRANT ALL ON public.bla_payouts TO service_role;
ALTER TABLE public.bla_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bla_payouts_own_or_admin" ON public.bla_payouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE INDEX bla_payouts_period_idx ON public.bla_payouts (period);

-- período corrente (fuso BR)
CREATE OR REPLACE FUNCTION public.current_bla_period()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
$$;
GRANT EXECUTE ON FUNCTION public.current_bla_period() TO authenticated, service_role;

-- acumula pontos mensais
CREATE OR REPLACE FUNCTION public.add_career_points(_user uuid, _points bigint, _period date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p date := COALESCE(_period, public.current_bla_period());
BEGIN
  IF _points = 0 THEN RETURN; END IF;
  INSERT INTO public.career_monthly_points (user_id, period, points)
  VALUES (_user, p, GREATEST(_points, 0))
  ON CONFLICT (user_id, period) DO UPDATE
    SET points = GREATEST(public.career_monthly_points.points + _points, 0), updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.add_career_points(uuid, bigint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_career_points(uuid, bigint, date) TO service_role;

-- pontos passam a alimentar o BLA
CREATE OR REPLACE FUNCTION public.credit_points(_user uuid, _points bigint, _cat text, _desc text DEFAULT NULL::text, _ref uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE after_v BIGINT;
BEGIN
  IF _points = 0 THEN RETURN; END IF;
  UPDATE public.wallets SET points_balance = points_balance + _points, updated_at = now()
    WHERE user_id = _user RETURNING points_balance INTO after_v;
  INSERT INTO public.points_transactions (user_id, direction, points, balance_after, category, description, reference_id)
  VALUES (_user, (CASE WHEN _points > 0 THEN 'in' ELSE 'out' END)::tx_direction, abs(_points), after_v, _cat::tx_category, _desc, _ref);

  IF _points > 0 AND _cat IN ('payment', 'referral') THEN
    PERFORM public.add_career_points(_user, _points, NULL);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) TO service_role;

-- graduação qualificada no período (pontos + requisitos de equipe)
CREATE OR REPLACE FUNCTION public.qualified_rank_level(_user uuid, _period date)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts bigint;
  r record;
  best integer := 0;
  cnt integer;
BEGIN
  SELECT COALESCE(points, 0) INTO pts FROM public.career_monthly_points
    WHERE user_id = _user AND period = _period;
  pts := COALESCE(pts, 0);

  FOR r IN SELECT * FROM public.career_ranks WHERE active ORDER BY level LOOP
    IF pts < r.points_required THEN CONTINUE; END IF;
    IF r.required_rank_count > 0 AND r.required_rank_level IS NOT NULL THEN
      SELECT count(*) INTO cnt
      FROM public.referrals rf
      JOIN public.user_career uc ON uc.user_id = rf.referred_id
      WHERE rf.sponsor_id = _user AND rf.level = 1 AND uc.rank_level >= r.required_rank_level;
      IF cnt < r.required_rank_count THEN CONTINUE; END IF;
    END IF;
    best := r.level;
  END LOOP;

  RETURN best;
END; $$;
GRANT EXECUTE ON FUNCTION public.qualified_rank_level(uuid, date) TO authenticated, service_role;

-- apuração mensal do BLA
CREATE OR REPLACE FUNCTION public.process_monthly_bla(_period date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p date := COALESCE(_period, (public.current_bla_period() - interval '1 month')::date);
  u record;
  lvl integer;
  rk record;
  processed integer := 0;
BEGIN
  -- promove primeiro (para requisitos de equipe usarem títulos atualizados)
  FOR u IN SELECT user_id FROM public.career_monthly_points WHERE period = p AND points > 0 LOOP
    lvl := public.qualified_rank_level(u.user_id, p);
    IF lvl > 0 THEN
      SELECT * INTO rk FROM public.career_ranks WHERE level = lvl;
      INSERT INTO public.user_career (user_id, rank_level, rank_name, achieved_at)
      VALUES (u.user_id, lvl, rk.name, now())
      ON CONFLICT (user_id) DO UPDATE SET
        rank_level = GREATEST(public.user_career.rank_level, EXCLUDED.rank_level),
        rank_name = CASE WHEN EXCLUDED.rank_level > public.user_career.rank_level
                         THEN EXCLUDED.rank_name ELSE public.user_career.rank_name END,
        achieved_at = CASE WHEN EXCLUDED.rank_level > public.user_career.rank_level
                           THEN now() ELSE public.user_career.achieved_at END,
        updated_at = now();
    END IF;
  END LOOP;

  -- paga o bônus da graduação qualificada no mês
  FOR u IN SELECT user_id, points FROM public.career_monthly_points WHERE period = p AND points > 0 LOOP
    IF EXISTS (SELECT 1 FROM public.bla_payouts WHERE user_id = u.user_id AND period = p) THEN
      CONTINUE;
    END IF;
    lvl := public.qualified_rank_level(u.user_id, p);
    IF lvl = 0 THEN
      INSERT INTO public.bla_payouts (user_id, period, rank_level, rank_name, points, amount, status, note)
      VALUES (u.user_id, p, 0, NULL, u.points, 0, 'not_qualified', 'Não atingiu os requisitos do período');
      CONTINUE;
    END IF;
    SELECT * INTO rk FROM public.career_ranks WHERE level = lvl;

    INSERT INTO public.bla_payouts (user_id, period, rank_level, rank_name, points, amount, status)
    VALUES (u.user_id, p, lvl, rk.name, u.points, rk.bonus, 'paid');

    IF rk.bonus > 0 THEN
      PERFORM public.credit_wallet(u.user_id, rk.bonus, 'referral', 'bonus',
        'BLA ' || rk.name || ' — ' || to_char(p, 'MM/YYYY'), NULL);
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (u.user_id, 'Bônus de Liderança Ativa',
        'Você recebeu R$ ' || to_char(rk.bonus, 'FM999G999D00') || ' de BLA (' || rk.name || ') referente a ' || to_char(p, 'MM/YYYY') || '.',
        'success');
    END IF;
    processed := processed + 1;
  END LOOP;

  RETURN processed;
END; $$;
REVOKE ALL ON FUNCTION public.process_monthly_bla(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_monthly_bla(date) TO service_role;

-- ferramentas do admin
CREATE OR REPLACE FUNCTION public.admin_adjust_career_points(_admin uuid, _user uuid, _period date, _points bigint, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.career_monthly_points (user_id, period, points)
  VALUES (_user, _period, GREATEST(_points, 0))
  ON CONFLICT (user_id, period) DO UPDATE SET points = GREATEST(_points, 0), updated_at = now();
  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'bla_points_set', 'career_monthly_points', _user,
          jsonb_build_object('period', _period, 'points', _points, 'reason', _reason));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.admin_adjust_career_points(uuid, uuid, date, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_career_points(uuid, uuid, date, bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_career_rank(_admin uuid, _user uuid, _level integer, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rk record;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
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
REVOKE ALL ON FUNCTION public.admin_set_career_rank(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_career_rank(uuid, uuid, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_run_bla(_admin uuid, _period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  n := public.process_monthly_bla(_period);
  INSERT INTO public.admin_logs (admin_id, action, table_name, new_value)
  VALUES (_admin, 'bla_run', 'bla_payouts', jsonb_build_object('period', _period, 'processed', n));
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.admin_run_bla(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_bla(uuid, date) TO authenticated, service_role;

-- visão do usuário
CREATE OR REPLACE FUNCTION public.get_my_bla()
RETURNS TABLE(period date, points bigint, rank_level integer, rank_name text, qualified_level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_bla_period(),
         COALESCE((SELECT points FROM public.career_monthly_points
                    WHERE user_id = auth.uid() AND period = public.current_bla_period()), 0)::bigint,
         COALESCE((SELECT rank_level FROM public.user_career WHERE user_id = auth.uid()), 0),
         (SELECT rank_name FROM public.user_career WHERE user_id = auth.uid()),
         public.qualified_rank_level(auth.uid(), public.current_bla_period());
$$;
GRANT EXECUTE ON FUNCTION public.get_my_bla() TO authenticated, service_role;