CREATE OR REPLACE FUNCTION public.withdrawal_auto_begin_submission(_wid uuid)
 RETURNS withdrawals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w public.withdrawals;
BEGIN
  UPDATE public.withdrawals
     SET status = 'submitting'::withdrawal_status,
         submitted_at = now(),
         idempotency_key = COALESCE(idempotency_key, 'connectpay-withdraw-' || _wid::text),
         external_id = COALESCE(external_id, _wid::text)
   WHERE id = _wid AND status = 'pending'::withdrawal_status
  RETURNING * INTO w;

  IF w.id IS NULL THEN
    RAISE EXCEPTION 'Este saque não está mais aguardando aprovação.';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (NULL, 'withdrawal_auto_submitting', 'withdrawals', _wid,
          jsonb_build_object('amount', w.amount, 'currency', w.currency, 'method', w.method));
  RETURN w;
END; $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(_user uuid, _amount numeric, _wallet text, _method text, _currency text, _network text, _key_type text, _key text, _address text, _auto boolean DEFAULT false)
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
          CASE WHEN _auto THEN ' foi registrada e está sendo processada automaticamente.' ELSE ' foi registrada e aguarda aprovação.' END, 'withdrawal');
  RETURN wid;
END; $function$