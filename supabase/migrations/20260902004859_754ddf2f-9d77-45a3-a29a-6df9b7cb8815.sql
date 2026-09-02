CREATE OR REPLACE FUNCTION public.process_monthly_bla(_period date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p date := COALESCE(_period, (public.current_bla_period() - interval '1 month')::date);
  u record;
  lvl integer;
  rk record;
  existing record;
  pts bigint;
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

  -- considera quem pontuou no mês E quem já é graduado (mesmo sem pontos)
  FOR u IN
    SELECT user_id FROM public.career_monthly_points WHERE period = p AND points > 0
    UNION
    SELECT user_id FROM public.user_career WHERE rank_level > 0
  LOOP
    SELECT * INTO existing FROM public.bla_payouts WHERE user_id = u.user_id AND period = p;
    IF FOUND AND existing.status = 'paid' THEN
      CONTINUE; -- nunca paga duas vezes
    END IF;

    SELECT COALESCE(points, 0) INTO pts FROM public.career_monthly_points
      WHERE user_id = u.user_id AND period = p;
    pts := COALESCE(pts, 0);

    lvl := public.qualified_rank_level(u.user_id, p);

    IF lvl = 0 THEN
      INSERT INTO public.bla_payouts (user_id, period, rank_level, rank_name, points, amount, status, note)
      VALUES (u.user_id, p, 0, NULL, pts, 0, 'not_qualified', 'Não atingiu os requisitos do período')
      ON CONFLICT (user_id, period) DO UPDATE SET
        rank_level = 0, rank_name = NULL, points = EXCLUDED.points,
        amount = 0, status = 'not_qualified', note = EXCLUDED.note;
      CONTINUE;
    END IF;

    SELECT * INTO rk FROM public.career_ranks WHERE level = lvl;

    INSERT INTO public.bla_payouts (user_id, period, rank_level, rank_name, points, amount, status)
    VALUES (u.user_id, p, lvl, rk.name, pts, rk.bonus, 'paid')
    ON CONFLICT (user_id, period) DO UPDATE SET
      rank_level = EXCLUDED.rank_level, rank_name = EXCLUDED.rank_name,
      points = EXCLUDED.points, amount = EXCLUDED.amount,
      status = 'paid', note = NULL;

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
END; $function$;