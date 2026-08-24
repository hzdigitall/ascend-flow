-- 1) ROI apenas 24h após ativação e no máximo 1x a cada 24h
CREATE OR REPLACE FUNCTION public.process_daily_roi()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC; last_at TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT up.*, p.price as plan_price, p.name as plan_name
    FROM public.user_plans up
    JOIN public.plans p ON p.id = up.plan_id
    WHERE up.status = 'active'
      AND up.activated_at IS NOT NULL
      AND up.activated_at <= now() - interval '24 hours'
  LOOP
    SELECT max(created_at) INTO last_at FROM public.daily_roi_logs WHERE user_plan_id = r.id;
    IF last_at IS NOT NULL AND last_at > now() - interval '24 hours' THEN
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
      max_amt := r.plan_price * 2.0;

      SELECT COALESCE(SUM(amount), 0) INTO current_total
      FROM public.wallet_transactions
      WHERE user_id = r.user_id AND reference_id = r.id AND category = 'earning';

      IF (current_total + roi_amt) >= max_amt THEN
        roi_amt := max_amt - current_total;
        UPDATE public.user_plans SET status = 'expired', updated_at = now() WHERE id = r.id;
      END IF;

      IF roi_amt > 0 THEN
        PERFORM public.credit_wallet(r.user_id, roi_amt, 'earnings', 'earning', 'Rendimento diário: ' || r.plan_name, r.id);
        INSERT INTO public.daily_roi_logs (user_plan_id, amount) VALUES (r.id, roi_amt);
      END IF;
    END IF;
  END LOOP;
END; $function$;

-- 2) confirm_payment: não lançar débito na carteira principal quando o pagamento já foi debitado do saldo
CREATE OR REPLACE FUNCTION public.confirm_payment(_payment uuid, _payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF pay.gateway <> 'balance' THEN
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

          IF lvl = 1 AND pay.amount >= 50 THEN
             pts := floor(pay.amount / 50.0) * 5;
             IF pts > 0 THEN
                PERFORM public.credit_points(cur, pts, 'referral', 'Pontos por indicação direta: ' || (SELECT full_name FROM public.profiles WHERE id = pay.user_id), pay.id);
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
END; $function$;

-- 3) Compra de plano com saldo (main / earnings / referral)
CREATE OR REPLACE FUNCTION public.purchase_plan_with_balance(_user uuid, _plan uuid, _wallet text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p RECORD; bal NUMERIC; after_v NUMERIC; up UUID; pay UUID; active_count INT; label TEXT;
BEGIN
  IF _wallet NOT IN ('main','earnings','referral') THEN RAISE EXCEPTION 'Carteira inválida'; END IF;

  SELECT * INTO p FROM public.plans WHERE id = _plan AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível'; END IF;
  IF p.purchase_blocked THEN RAISE EXCEPTION 'Indisponível para aquisição no momento'; END IF;

  SELECT count(*) INTO active_count FROM public.user_plans
    WHERE user_id = _user AND plan_id = _plan AND status = 'active';
  IF active_count >= 4 THEN RAISE EXCEPTION 'Você atingiu o limite máximo de 4 planos ativos deste mesmo tipo.'; END IF;

  SELECT CASE _wallet WHEN 'main' THEN main_balance WHEN 'earnings' THEN earnings_balance ELSE referral_balance END
    INTO bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF bal IS NULL OR bal < p.price THEN RAISE EXCEPTION 'Saldo insuficiente nesta carteira'; END IF;

  after_v := bal - p.price;
  UPDATE public.wallets SET
    main_balance = CASE WHEN _wallet='main' THEN after_v ELSE main_balance END,
    earnings_balance = CASE WHEN _wallet='earnings' THEN after_v ELSE earnings_balance END,
    referral_balance = CASE WHEN _wallet='referral' THEN after_v ELSE referral_balance END,
    updated_at = now()
  WHERE user_id = _user;

  label := CASE _wallet WHEN 'main' THEN 'saldo principal' WHEN 'earnings' THEN 'rendimentos' ELSE 'bônus de indicação' END;

  INSERT INTO public.user_plans (user_id, plan_id, plan_name, price, points_granted, status)
  VALUES (_user, p.id, p.name, p.price, p.points, 'pending') RETURNING id INTO up;

  INSERT INTO public.payments (user_id, plan_id, user_plan_id, amount, status, gateway)
  VALUES (_user, p.id, up, p.price, 'pending', 'balance') RETURNING id INTO pay;

  INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, balance_before, balance_after, description, reference_id, status)
  VALUES (_user, _wallet::wallet_type, 'out'::tx_direction, 'payment', p.price, bal, after_v,
          'Compra do plano ' || p.name || ' com ' || label, pay, 'completed');

  INSERT INTO public.payment_events (payment_id, event_type, payload)
  VALUES (pay, 'created', jsonb_build_object('plan', p.name, 'source', 'balance', 'wallet', _wallet));

  PERFORM public.confirm_payment(pay, jsonb_build_object('source', 'balance', 'wallet', _wallet));
  RETURN up;
END; $function$;

REVOKE ALL ON FUNCTION public.purchase_plan_with_balance(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_plan_with_balance(uuid, uuid, text) TO service_role;