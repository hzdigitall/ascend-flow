-- Renomeia planos existentes para o padrão "Nível Valor" e cria os planos faltantes de cada faixa
DO $$
DECLARE
  tiers jsonb := '[
    {"n":"Iniciante","p":3.50,"d":29,"a":[50,100,150]},
    {"n":"Intermediário","p":4.50,"d":23,"a":[200,250,300,350,400,450]},
    {"n":"Avançado","p":5.50,"d":19,"a":[500,550,600,650,700,750,800,850,900,950]},
    {"n":"Profissional","p":6.50,"d":16,"a":[1000,1500,2000,2500]},
    {"n":"Elite","p":7.50,"d":14,"a":[3000,3500,4000,4500,5000]}
  ]'::jsonb;
  t jsonb; amt numeric; nm text; so int := 0; pct numeric; days int;
BEGIN
  FOR t IN SELECT * FROM jsonb_array_elements(tiers) LOOP
    pct := (t->>'p')::numeric;
    days := (t->>'d')::int;
    FOR amt IN SELECT (jsonb_array_elements_text(t->'a'))::numeric LOOP
      so := so + 1;
      nm := (t->>'n') || ' ' || amt::bigint::text;
      UPDATE public.plans SET name = nm WHERE name = (t->>'n') AND price = amt;

      IF EXISTS (SELECT 1 FROM public.plans WHERE name = nm) THEN
        UPDATE public.plans SET
          description = replace(pct::text,'.',',') || '% ao dia. Dobra em ' || days || ' dias úteis.',
          price = amt,
          points = floor(amt/10)::int,
          benefits = ARRAY['Rende até R$ ' || (amt*2)::bigint::text || ',00','Pontos Arena','Pagamento PIX'],
          validity_days = 45,
          sort_order = so,
          active = true,
          updated_at = now()
        WHERE name = nm;
      ELSE
        INSERT INTO public.plans (name, description, price, points, benefits, validity_days, sort_order, active, purchase_blocked)
        VALUES (nm,
          replace(pct::text,'.',',') || '% ao dia. Dobra em ' || days || ' dias úteis.',
          amt, floor(amt/10)::int,
          ARRAY['Rende até R$ ' || (amt*2)::bigint::text || ',00','Pontos Arena','Pagamento PIX'],
          45, so, true, true);
      END IF;
    END LOOP;
  END LOOP;
END $$;


-- ROI diário reconhece nomes com valor (prefixo da faixa)
CREATE OR REPLACE FUNCTION public.process_daily_roi()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC; last_at TIMESTAMPTZ; dow INT; finished BOOLEAN;
BEGIN
  PERFORM public.expire_due_plans(NULL);
  PERFORM public.notify_expiring_plans(3);

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
      WHEN r.plan_name LIKE 'Iniciante%' THEN 3.50
      WHEN r.plan_name LIKE 'Intermediário%' THEN 4.50
      WHEN r.plan_name LIKE 'Avançado%' THEN 5.50
      WHEN r.plan_name LIKE 'Profissional%' THEN 6.50
      WHEN r.plan_name LIKE 'Elite%' THEN 7.50
      ELSE 0
    END;

    IF roi_pct > 0 THEN
      roi_amt := round(r.plan_price * roi_pct / 100.0, 2);
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
        INSERT INTO public.plan_audit_logs
          (user_plan_id, user_id, plan_name, event, old_status, new_status, earned_total, details)
        VALUES (r.id, r.user_id, r.plan_name, 'plan_cycle_completed', 'active', 'expired',
                current_total + COALESCE(roi_amt,0), jsonb_build_object('cap', max_amt));

        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (r.user_id, 'Ciclo do plano concluído',
                'Seu plano ' || r.plan_name || ' concluiu o ciclo de rendimentos.',
                'earning');
      END IF;
    END IF;
  END LOOP;
END;
$function$;