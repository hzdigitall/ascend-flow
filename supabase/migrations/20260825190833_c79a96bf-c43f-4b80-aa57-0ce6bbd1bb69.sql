ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payment_purpose text NOT NULL DEFAULT 'wallet_deposit',
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(18,8),
  ADD COLUMN IF NOT EXISTS crypto_amount numeric(24,8),
  ADD COLUMN IF NOT EXISTS brl_amount numeric(18,2);

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(18,8),
  ADD COLUMN IF NOT EXISTS crypto_amount numeric(24,8);

CREATE OR REPLACE FUNCTION public.usdt_brl_rate()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT GREATEST(COALESCE((public.get_setting('usdt_brl_rate','5'::jsonb) #>> '{}')::numeric, 5), 0.01);
$$;

CREATE OR REPLACE FUNCTION public.credit_deposit(_deposit uuid, _payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d RECORD; before_v NUMERIC; after_v NUMERIC; brl NUMERIC; rate NUMERIC; pay RECORD; use_plan BOOLEAN := false;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = _deposit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Depósito não encontrado'; END IF;
  IF d.credited_at IS NOT NULL THEN RETURN false; END IF;

  IF d.currency = 'USDT' THEN
    rate := COALESCE(d.conversion_rate, public.usdt_brl_rate());
    brl := round(d.amount * rate, 2);
  ELSE
    rate := 1;
    brl := round(d.amount, 2);
  END IF;

  UPDATE public.deposits
     SET status = 'credited', credited_at = now(),
         conversion_rate = rate,
         crypto_amount = CASE WHEN d.currency = 'USDT' THEN d.amount ELSE NULL END,
         brl_amount = brl,
         metadata = COALESCE(metadata,'{}'::jsonb) || COALESCE(_payload,'{}'::jsonb)
   WHERE id = d.id;

  IF d.payment_purpose = 'plan_purchase' AND d.payment_id IS NOT NULL THEN
    SELECT * INTO pay FROM public.payments WHERE id = d.payment_id;
    IF FOUND AND pay.status <> 'paid' AND brl + 0.01 >= pay.amount THEN
      use_plan := true;
    END IF;
  END IF;

  IF use_plan THEN
    SELECT main_balance INTO before_v FROM public.wallets WHERE user_id = d.user_id FOR UPDATE;
    INSERT INTO public.wallet_transactions
      (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
       description, reference_id, reference_type, status, currency, provider, metadata)
    VALUES (d.user_id, 'main'::wallet_type, 'out'::tx_direction, 'payment'::tx_category, brl,
            COALESCE(before_v,0), COALESCE(before_v,0),
            'Pagamento aplicado diretamente na aquisição do plano ('
              || CASE WHEN d.currency='USDT' THEN trim(to_char(d.amount,'FM999999990.00######')) || ' USDT' ELSE 'PIX' END || ')',
            d.payment_id, 'payment', 'completed'::tx_status, 'BRL', d.provider,
            jsonb_build_object('deposit_id', d.id, 'conversion_rate', rate,
                               'crypto_amount', CASE WHEN d.currency='USDT' THEN d.amount ELSE NULL END,
                               'converted_brl', brl, 'payment_purpose', 'plan_purchase'));

    PERFORM public.confirm_payment(d.payment_id,
      jsonb_build_object('source', 'deposit', 'deposit_id', d.id, 'provider', d.provider,
                         'conversion_rate', rate, 'converted_brl', brl));
    RETURN true;
  END IF;

  SELECT main_balance INTO before_v FROM public.wallets WHERE user_id = d.user_id FOR UPDATE;
  after_v := COALESCE(before_v,0) + brl;
  UPDATE public.wallets SET main_balance = after_v, updated_at = now() WHERE user_id = d.user_id;

  INSERT INTO public.wallet_transactions
    (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
     description, reference_id, reference_type, status, currency, provider, metadata)
  VALUES (d.user_id, 'main'::wallet_type, 'in'::tx_direction, 'deposit'::tx_category, brl,
          COALESCE(before_v,0), after_v,
          CASE WHEN d.currency = 'USDT'
               THEN 'Depósito de ' || trim(to_char(d.amount,'FM999999990.00######')) || ' USDT (BEP20) convertido a R$ ' || trim(to_char(rate,'FM999990.00')) || ' por USDT'
               ELSE 'Depósito PIX confirmado' END,
          d.id, 'deposit', 'completed'::tx_status, 'BRL', d.provider,
          jsonb_build_object('conversion_rate', rate,
                             'crypto_amount', CASE WHEN d.currency='USDT' THEN d.amount ELSE NULL END,
                             'converted_brl', brl, 'payment_purpose', 'wallet_deposit'));

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (d.user_id, 'Depósito confirmado',
          'Seu depósito foi creditado: R$ ' || trim(to_char(brl,'FM999999990.00'))
          || CASE WHEN d.currency='USDT' THEN ' (' || trim(to_char(d.amount,'FM999999990.00######')) || ' USDT × R$ ' || trim(to_char(rate,'FM999990.00')) || ')' ELSE '' END || '.',
          'payment');
  RETURN true;
END; $function$;

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

CREATE OR REPLACE FUNCTION public.create_plan_checkout(_user uuid, _plan uuid, _provider text)
 RETURNS TABLE(payment_id uuid, user_plan_id uuid, price numeric, plan_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p RECORD; up UUID; pay UUID; mins INT; active_count INT;
BEGIN
  IF _provider NOT IN ('connectpay','nowpayments') THEN RAISE EXCEPTION 'Provedor inválido'; END IF;
  SELECT * INTO p FROM public.plans WHERE id = _plan AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível'; END IF;
  IF p.purchase_blocked THEN RAISE EXCEPTION 'Indisponível para aquisição no momento'; END IF;

  SELECT count(*) INTO active_count FROM public.user_plans
    WHERE user_id = _user AND plan_id = _plan AND status = 'active';
  IF active_count >= 4 THEN RAISE EXCEPTION 'Você atingiu o limite máximo de 4 planos ativos deste mesmo tipo.'; END IF;

  mins := COALESCE((public.get_setting('pix_expiration_minutes','30'::jsonb))::int, 30);

  INSERT INTO public.user_plans (user_id, plan_id, plan_name, price, points_granted, status)
  VALUES (_user, p.id, p.name, p.price, p.points, 'pending') RETURNING id INTO up;

  INSERT INTO public.payments (user_id, plan_id, user_plan_id, amount, status, gateway, expires_at)
  VALUES (_user, p.id, up, p.price, 'pending', _provider, now() + (mins || ' minutes')::interval)
  RETURNING id INTO pay;

  INSERT INTO public.payment_events (payment_id, event_type, payload)
  VALUES (pay, 'created', jsonb_build_object('plan', p.name, 'provider', _provider, 'purpose', 'plan_purchase'));

  RETURN QUERY SELECT pay, up, p.price, p.name;
END; $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(_user uuid, _amount numeric, _wallet text, _method text, _currency text, _network text, _key_type text, _key text, _address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE bal NUMERIC; min_v NUMERIC; max_v NUMERIC; fee_pct NUMERIC; fee NUMERIC; net NUMERIC; wid UUID; after_v NUMERIC; rate NUMERIC; crypto NUMERIC;
BEGIN
  IF _wallet NOT IN ('earnings','referral') THEN RAISE EXCEPTION 'Carteira inválida para saque'; END IF;

  min_v := COALESCE((public.get_setting('withdraw_min','20'::jsonb))::numeric, 20);
  max_v := COALESCE((public.get_setting('withdraw_max','5000'::jsonb))::numeric, 5000);
  fee_pct := COALESCE((public.get_setting('withdraw_fee_percent','2'::jsonb))::numeric, 0);
  IF _amount < min_v THEN RAISE EXCEPTION 'Valor mínimo de saque: R$ %', min_v; END IF;
  IF _amount > max_v THEN RAISE EXCEPTION 'Valor máximo de saque: R$ %', max_v; END IF;

  SELECT CASE _wallet WHEN 'earnings' THEN earnings_balance ELSE referral_balance END INTO bal
    FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF bal IS NULL OR bal < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  fee := round(_amount * fee_pct / 100.0, 2);
  net := _amount - fee;
  after_v := bal - _amount;

  UPDATE public.wallets SET
    earnings_balance = CASE WHEN _wallet='earnings' THEN after_v ELSE earnings_balance END,
    referral_balance = CASE WHEN _wallet='referral' THEN after_v ELSE referral_balance END,
    reserved_balance = reserved_balance + _amount,
    updated_at = now()
  WHERE user_id = _user;

  IF _currency = 'USDT' THEN
    IF _network <> 'BEP20' THEN RAISE EXCEPTION 'Rede inválida. Utilize BEP20.'; END IF;
    IF _address IS NULL OR trim(_address) !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Endereço de carteira BEP20 inválido'; END IF;

    rate := public.usdt_brl_rate();
    crypto := round(net / rate, 6);
    IF crypto <= 0 THEN RAISE EXCEPTION 'Valor convertido em USDT inválido'; END IF;

    INSERT INTO public.withdrawals
      (user_id, wallet_type, amount, fee, net_amount, status, method, currency, network,
       wallet_address, provider, conversion_rate, crypto_amount, metadata)
    VALUES (_user, _wallet::wallet_type, _amount, fee, net, 'pending'::withdrawal_status,
            'crypto', 'USDT', 'BEP20', trim(_address), 'nowpayments', rate, crypto,
            jsonb_build_object('pay_currency','usdtbsc','conversion_rate',rate,'crypto_amount',crypto,'brl_amount',_amount))
    RETURNING id INTO wid;

    INSERT INTO public.wallet_transactions
      (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
       description, reference_id, reference_type, status, currency, provider, metadata)
    VALUES (_user, _wallet::wallet_type, 'out'::tx_direction, 'withdrawal'::tx_category, _amount,
            bal, after_v,
            'Solicitação de saque USDT (BEP20): R$ ' || trim(to_char(net,'FM999999990.00')) || ' líquidos = '
              || trim(to_char(crypto,'FM999999990.000000')) || ' USDT (R$ ' || trim(to_char(rate,'FM999990.00')) || ' por USDT)',
            wid, 'withdrawal', 'pending'::tx_status, 'BRL', 'nowpayments',
            jsonb_build_object('conversion_rate',rate,'crypto_amount',crypto));

    UPDATE public.withdrawals
       SET external_id = wid::text,
           unique_external_id = 'arena-payout-' || wid::text,
           idempotency_key = 'nowpayments-payout-' || wid::text
     WHERE id = wid;
  ELSE
    IF _key IS NULL OR length(trim(_key)) < 3 THEN RAISE EXCEPTION 'Chave PIX inválida'; END IF;

    INSERT INTO public.withdrawals
      (user_id, wallet_type, amount, fee, net_amount, pix_key_type, pix_key_value, status,
       method, currency, provider, conversion_rate, metadata)
    VALUES (_user, _wallet::wallet_type, _amount, fee, net, _key_type::pix_key_type, trim(_key),
            'pending'::withdrawal_status, 'pix', 'BRL', 'connectpay', 1, '{}'::jsonb)
    RETURNING id INTO wid;

    INSERT INTO public.wallet_transactions
      (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
       description, reference_id, reference_type, status, currency, provider)
    VALUES (_user, _wallet::wallet_type, 'out'::tx_direction, 'withdrawal'::tx_category, _amount,
            bal, after_v, 'Solicitação de saque via PIX', wid, 'withdrawal',
            'pending'::tx_status, 'BRL', 'connectpay');

    UPDATE public.withdrawals
       SET external_id = wid::text, idempotency_key = 'connectpay-withdraw-' || wid::text
     WHERE id = wid;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Saque solicitado',
          'Sua solicitação de saque de R$ ' || trim(to_char(_amount,'FM999999990.00')) ||
          CASE WHEN _currency='USDT' THEN ' (' || trim(to_char(crypto,'FM999999990.000000')) || ' USDT)' ELSE '' END ||
          ' foi registrada e aguarda aprovação.', 'withdrawal');
  RETURN wid;
END; $function$;

CREATE OR REPLACE FUNCTION public.withdrawal_complete(_wid uuid, _provider_tx text, _tx_hash text, _payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w RECORD;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _wid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF w.status = 'paid'::withdrawal_status THEN RETURN false; END IF;

  UPDATE public.withdrawals
     SET status = 'paid'::withdrawal_status, processed_at = now(), completed_at = now(),
         provider_transaction_id = COALESCE(_provider_tx, provider_transaction_id),
         tx_hash = COALESCE(_tx_hash, tx_hash),
         metadata = COALESCE(metadata,'{}'::jsonb) || COALESCE(_payload,'{}'::jsonb)
   WHERE id = _wid;

  IF w.wallet_type::text = 'usdt' THEN
    UPDATE public.wallets SET usdt_reserved = GREATEST(usdt_reserved - w.amount, 0), updated_at = now()
     WHERE user_id = w.user_id;
  ELSE
    UPDATE public.wallets SET reserved_balance = GREATEST(reserved_balance - w.amount, 0), updated_at = now()
     WHERE user_id = w.user_id;
  END IF;

  UPDATE public.wallet_transactions SET status = 'completed'::tx_status
   WHERE reference_id = _wid AND category = 'withdrawal'::tx_category AND status = 'pending'::tx_status;

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (w.user_id, 'Saque concluído',
          'Seu saque foi concluído: ' ||
          CASE WHEN w.currency = 'USDT'
               THEN trim(to_char(COALESCE(w.crypto_amount, w.net_amount),'FM999999990.000000')) || ' USDT'
               ELSE 'R$ ' || trim(to_char(w.net_amount,'FM999999990.00')) END || '.',
          'withdrawal');
  RETURN true;
END; $function$;

CREATE OR REPLACE FUNCTION public.withdrawal_release(_wid uuid, _status text, _reason text, _payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w RECORD; before_v NUMERIC; after_v NUMERIC;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _wid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF w.status = 'paid'::withdrawal_status THEN RETURN false; END IF;
  IF w.released_at IS NOT NULL THEN RETURN false; END IF;

  UPDATE public.withdrawals
     SET status = _status::withdrawal_status, reject_reason = COALESCE(_reason, reject_reason),
         failure_reason = COALESCE(_reason, failure_reason),
         processed_at = now(), released_at = now(),
         metadata = COALESCE(metadata,'{}'::jsonb) || COALESCE(_payload,'{}'::jsonb)
   WHERE id = _wid;

  IF w.wallet_type::text = 'usdt' THEN
    SELECT usdt_balance INTO before_v FROM public.wallets WHERE user_id = w.user_id FOR UPDATE;
    after_v := COALESCE(before_v,0) + w.amount;
    UPDATE public.wallets
       SET usdt_balance = after_v, usdt_reserved = GREATEST(usdt_reserved - w.amount, 0), updated_at = now()
     WHERE user_id = w.user_id;
  ELSE
    SELECT CASE w.wallet_type::text WHEN 'earnings' THEN earnings_balance WHEN 'referral' THEN referral_balance ELSE main_balance END
      INTO before_v FROM public.wallets WHERE user_id = w.user_id FOR UPDATE;
    after_v := COALESCE(before_v,0) + w.amount;
    UPDATE public.wallets SET
      earnings_balance = CASE WHEN w.wallet_type::text='earnings' THEN after_v ELSE earnings_balance END,
      referral_balance = CASE WHEN w.wallet_type::text='referral' THEN after_v ELSE referral_balance END,
      main_balance = CASE WHEN w.wallet_type::text NOT IN ('earnings','referral') THEN after_v ELSE main_balance END,
      reserved_balance = GREATEST(reserved_balance - w.amount, 0),
      updated_at = now()
    WHERE user_id = w.user_id;
  END IF;

  UPDATE public.wallet_transactions SET status = 'cancelled'::tx_status
   WHERE reference_id = _wid AND category = 'withdrawal'::tx_category AND status = 'pending'::tx_status;

  INSERT INTO public.wallet_transactions
    (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
     description, reference_id, reference_type, status, currency, provider)
  VALUES (w.user_id, w.wallet_type, 'in'::tx_direction, 'reversal'::tx_category, w.amount,
          COALESCE(before_v,0), after_v,
          'Devolução de saque ' || _status || COALESCE(': ' || _reason, ''), _wid, 'withdrawal',
          'completed'::tx_status, CASE WHEN w.wallet_type::text='usdt' THEN 'USDT' ELSE 'BRL' END, w.provider);

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (w.user_id, 'Saque não concluído',
          COALESCE(_reason, 'Sua solicitação de saque não foi concluída e o valor foi devolvido ao seu saldo.'),
          'withdrawal');
  RETURN true;
END; $function$;

REVOKE ALL ON FUNCTION public.credit_deposit(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_payment(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_plan_checkout(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdrawal_complete(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdrawal_release(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_plan_checkout(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.withdrawal_complete(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.withdrawal_release(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.usdt_brl_rate() TO authenticated, service_role;