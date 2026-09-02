CREATE OR REPLACE FUNCTION public.admin_grant_plan(_admin uuid, _user uuid, _plan uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p RECORD; up UUID; pay UUID;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado'; END IF;

  INSERT INTO public.user_plans (user_id, plan_id, plan_name, price, points_granted, status, activated_at, expires_at)
  VALUES (_user, p.id, p.name, p.price, 0, 'active', now(),
          now() + (COALESCE(p.validity_days,30) || ' days')::interval)
  RETURNING id INTO up;

  INSERT INTO public.payments (user_id, plan_id, user_plan_id, amount, status, gateway, paid_at)
  VALUES (_user, p.id, up, p.price, 'paid', 'admin', now()) RETURNING id INTO pay;

  INSERT INTO public.payment_events (payment_id, event_type, payload)
  VALUES (pay, 'paid', jsonb_build_object('source','admin','admin_id',_admin,'reason',_reason,'commissions','skipped','points','skipped'));

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'plan_granted_manually', 'user_plans', up,
          jsonb_build_object('plan', p.name, 'user_id', _user, 'reason', _reason, 'commissions', 'skipped', 'points', 'skipped'));

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Plano ativado', 'O plano ' || p.name || ' foi ativado na sua conta pela administração.', 'payment');
  RETURN up;
END; $function$;

CREATE OR REPLACE FUNCTION public.process_daily_roi()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC; last_at TIMESTAMPTZ; dow INT; finished BOOLEAN; is_manual BOOLEAN; team_real NUMERIC;
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

    -- Plano liberado manualmente pelo admin: só rende quando os indicados diretos
    -- somarem, em depósitos reais (PIX/USDT), pelo menos o valor do plano.
    SELECT EXISTS (
      SELECT 1 FROM public.payments pm
      WHERE pm.user_plan_id = r.id AND pm.gateway = 'admin' AND pm.status = 'paid'
    ) INTO is_manual;

    IF is_manual THEN
      SELECT COALESCE(SUM(pm.amount), 0) INTO team_real
      FROM public.payments pm
      JOIN public.profiles pr ON pr.id = pm.user_id
      WHERE pr.sponsor_id = r.user_id
        AND pm.status = 'paid'
        AND pm.gateway NOT IN ('admin', 'balance');

      IF team_real < r.plan_price THEN
        CONTINUE;
      END IF;
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