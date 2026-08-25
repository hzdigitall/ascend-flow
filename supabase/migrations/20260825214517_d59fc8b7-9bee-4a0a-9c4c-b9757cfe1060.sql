CREATE OR REPLACE FUNCTION public.process_daily_roi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC; last_at TIMESTAMPTZ; dow INT; finished BOOLEAN;
BEGIN
  -- Rendimentos apenas em dias úteis (seg-sex) no fuso de Brasília
  dow := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Sao_Paulo'));
  IF dow > 5 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT up.*, p.price AS plan_price, p.name AS plan_name
    FROM public.user_plans up
    JOIN public.plans p ON p.id = up.plan_id
    WHERE up.status = 'active'
      AND up.activated_at IS NOT NULL
      AND up.activated_at <= now() - interval '24 hours'
  LOOP
    SELECT max(created_at) INTO last_at FROM public.daily_roi_logs WHERE user_plan_id = r.id;
    IF last_at IS NOT NULL AND last_at > now() - interval '20 hours' THEN
      CONTINUE;
    END IF;

    roi_pct := CASE
      WHEN r.plan_name = 'Iniciante' THEN 3.50
      WHEN r.plan_name = 'Intermediário' THEN 4.50
      WHEN r.plan_name = 'Avançado' THEN 6.50
      WHEN r.plan_name = 'Profissional' THEN 6.50
      WHEN r.plan_name = 'Elite' THEN 7.50
      ELSE 0
    END;

    IF roi_pct > 0 THEN
      roi_amt := round(r.plan_price * roi_pct / 100.0, 2);
      -- O plano rende até dobrar: o total de rendimentos alcança o valor investido
      max_amt := round(r.plan_price, 2);
      finished := false;

      SELECT COALESCE(SUM(amount), 0) INTO current_total
      FROM public.wallet_transactions
      WHERE user_id = r.user_id AND reference_id = r.id AND category = 'earning';

      IF (current_total + roi_amt) >= max_amt THEN
        roi_amt := round(max_amt - current_total, 2);
        finished := true;
        UPDATE public.user_plans SET status = 'expired', updated_at = now() WHERE id = r.id;
      END IF;

      IF roi_amt > 0 THEN
        PERFORM public.credit_wallet(r.user_id, roi_amt, 'earnings', 'earning', 'Rendimento diário: ' || r.plan_name, r.id);
        INSERT INTO public.daily_roi_logs (user_plan_id, amount) VALUES (r.id, roi_amt);

        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (r.user_id, 'Rendimento diário creditado',
                'Seu plano ' || r.plan_name || ' rendeu R$ ' || trim(to_char(roi_amt,'FM999999990.00')) || ' hoje.',
                'earning');
      END IF;

      IF finished THEN
        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (r.user_id, 'Ciclo do plano concluído',
                'Seu plano ' || r.plan_name || ' concluiu o ciclo de rendimentos.',
                'earning');
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_daily_roi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_roi() TO service_role;