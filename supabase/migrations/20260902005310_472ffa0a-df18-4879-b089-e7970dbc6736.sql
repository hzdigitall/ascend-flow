CREATE OR REPLACE FUNCTION public.confirm_payment(_payment uuid, _payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE pay RECORD; pl RECORD; lvl INT; pct NUMERIC; amt NUMERIC; rates JSONB; cur UUID; pts BIGINT;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE id = _payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF pay.status = 'paid' THEN RETURN false; END IF;

  UPDATE public.payments SET status='paid', paid_at=now() WHERE id = pay.id;
  INSERT INTO public.payment_events (payment_id, event_type, payload) VALUES (pay.id, 'paid', COALESCE(_payload,'{}'::jsonb));

  IF pay.user_plan_id IS NOT NULL THEN
    SELECT up.*, p.validity_days INTO pl FROM public.user_plans up JOIN public.plans p ON p.id = up.plan_id WHERE up.id = pay.user_plan_id;
    UPDATE public.user_plans SET status='active', activated_at=now(),
      expires_at = now() + (COALESCE(pl.validity_days,30) || ' days')::interval
      WHERE id = pay.user_plan_id;
    IF pl.points_granted > 0 THEN
      PERFORM public.credit_points(pay.user_id, pl.points_granted::bigint, 'payment', 'Pontos do plano ' || pl.plan_name, pay.id);
    END IF;
  END IF;

  IF pay.gateway NOT IN ('balance','connectpay','nowpayments','admin') THEN
    INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, description, reference_id)
    VALUES (pay.user_id, 'main', 'out'::tx_direction, 'payment', pay.amount, 'Compra de plano', pay.id);
  END IF;

  rates := public.get_setting('referral_rates', '{"1":12,"2":5,"3":3,"4":2,"5":1,"6":1,"7":1,"8":1}'::jsonb);
  SELECT sponsor_id INTO cur FROM public.profiles WHERE id = pay.user_id;
  lvl := 1;
  WHILE cur IS NOT NULL AND lvl <= 8 LOOP
    pct := COALESCE((rates ->> lvl::text)::numeric, 0);
    IF pct > 0 THEN
      amt := round(pay.amount * pct / 100.0, 2);
      IF amt > 0 THEN
        INSERT INTO public.commissions (sponsor_id, referred_id, payment_id, level, percentage, amount)
        VALUES (cur, pay.user_id, pay.id, lvl, pct, amt) ON CONFLICT DO NOTHING;
        IF FOUND THEN
          PERFORM public.credit_wallet(cur, amt, 'referral', 'referral', 'Comissão nível ' || lvl, pay.id);
          INSERT INTO public.notifications (user_id, title, body, type)
          VALUES (cur, 'Comissão recebida', 'Você recebeu R$ ' || amt || ' de comissão (nível ' || lvl || ').', 'referral');

          IF lvl <= 3 AND pay.amount >= 50 THEN
             pts := floor(pay.amount / 50.0);
             IF pts > 0 THEN
                PERFORM public.credit_points(cur, pts, 'referral', 'Pontos por indicação (nível ' || lvl || '): ' || (SELECT full_name FROM public.profiles WHERE id = pay.user_id), pay.id);
             END IF;
          END IF;
        END IF;
      END IF;
    END IF;
    SELECT sponsor_id INTO cur FROM public.profiles WHERE id = cur;
    lvl := lvl + 1;
  END LOOP;

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (pay.user_id, 'Pagamento aprovado', 'Seu pagamento foi confirmado e o plano foi ativado.', 'payment');
  RETURN true;
END;
$fn$;

SELECT cron.unschedule('process-monthly-bla');
SELECT cron.schedule('process-monthly-bla', '0 3 15 * *', $$select public.process_monthly_bla()$$);