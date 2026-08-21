-- Drop all variations of the functions to ensure a clean state
DROP FUNCTION IF EXISTS public.credit_points(uuid, bigint, text, text, uuid);
DROP FUNCTION IF EXISTS public.credit_points(uuid, bigint, tx_category, text, uuid);
DROP FUNCTION IF EXISTS public.credit_wallet(uuid, numeric, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.credit_wallet(uuid, wallet_type, numeric, tx_category, text, uuid);
DROP FUNCTION IF EXISTS public.request_withdrawal(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.request_withdrawal(uuid, wallet_type, numeric, pix_key_type, text);

-- Recreate credit_points with correct types and casting
CREATE OR REPLACE FUNCTION public.credit_points(
  _user uuid,
  _points bigint,
  _cat text,
  _desc text DEFAULT NULL::text,
  _ref uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE after_v BIGINT;
BEGIN
  IF _points = 0 THEN RETURN; END IF;
  UPDATE public.wallets SET points_balance = points_balance + _points, updated_at = now()
    WHERE user_id = _user RETURNING points_balance INTO after_v;
  INSERT INTO public.points_transactions (user_id, direction, points, balance_after, category, description, reference_id)
  VALUES (_user, (CASE WHEN _points > 0 THEN 'in' ELSE 'out' END)::tx_direction, abs(_points), after_v, _cat, _desc, _ref);
END;
$$;

-- Recreate credit_wallet with correct types and casting
CREATE OR REPLACE FUNCTION public.credit_wallet(
  _user uuid,
  _amount numeric,
  _wallet text,
  _cat text,
  _desc text DEFAULT NULL::text,
  _ref uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE before_v NUMERIC; after_v NUMERIC;
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  SELECT CASE _wallet WHEN 'main' THEN main_balance WHEN 'earnings' THEN earnings_balance WHEN 'referral' THEN referral_balance ELSE 0 END
    INTO before_v FROM public.wallets WHERE user_id = _user FOR UPDATE;
  after_v := before_v + _amount;
  UPDATE public.wallets SET
    main_balance = CASE WHEN _wallet='main' THEN after_v ELSE main_balance END,
    earnings_balance = CASE WHEN _wallet='earnings' THEN after_v ELSE earnings_balance END,
    referral_balance = CASE WHEN _wallet='referral' THEN after_v ELSE referral_balance END,
    updated_at = now()
  WHERE user_id = _user;
  INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, balance_before, balance_after, description, reference_id)
  VALUES (_user, _wallet::wallet_type, 'in'::tx_direction, _cat, _amount, before_v, after_v, _desc, _ref);
END;
$$;

-- Recreate request_withdrawal with correct types and casting
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _user uuid,
  _amount numeric,
  _wallet text,
  _key_type text,
  _key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bal NUMERIC; min_v NUMERIC; max_v NUMERIC; fee_pct NUMERIC; fee NUMERIC; net NUMERIC; wid UUID; after_v NUMERIC;
BEGIN
  IF _wallet NOT IN ('earnings','referral') THEN RAISE EXCEPTION 'Carteira inválida para saque'; END IF;
  IF _key IS NULL OR length(trim(_key)) < 3 THEN RAISE EXCEPTION 'Chave PIX inválida'; END IF;
  min_v := COALESCE((public.get_setting('withdraw_min','20'::jsonb))::numeric, 20);
  max_v := COALESCE((public.get_setting('withdraw_max','5000'::jsonb))::numeric, 5000);
  fee_pct := COALESCE((public.get_setting('withdraw_fee_percent','2'::jsonb))::numeric, 0);
  IF _amount < min_v THEN RAISE EXCEPTION 'Valor mínimo de saque: %', min_v; END IF;
  IF _amount > max_v THEN RAISE EXCEPTION 'Valor máximo de saque: %', max_v; END IF;

  SELECT CASE _wallet WHEN 'earnings' THEN earnings_balance ELSE referral_balance END INTO bal
    FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF bal IS NULL OR bal < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  fee := round(_amount * fee_pct / 100.0, 2);
  net := _amount - fee;
  after_v := bal - _amount;

  UPDATE public.wallets SET
    earnings_balance = CASE WHEN _wallet='earnings' THEN after_v ELSE earnings_balance END,
    referral_balance = CASE WHEN _wallet='referral' THEN after_v ELSE referral_balance END,
    updated_at = now()
  WHERE user_id = _user;

  INSERT INTO public.withdrawals (user_id, wallet_type, amount, fee, net_amount, pix_key_type, pix_key_value, status)
  VALUES (_user, _wallet::wallet_type, _amount, fee, net, _key_type::pix_key_type, _key, 'pending') RETURNING id INTO wid;

  INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, balance_before, balance_after, description, reference_id, status)
  VALUES (_user, _wallet::wallet_type, 'out'::tx_direction, 'withdrawal', _amount, bal, after_v, 'Solicitação de saque via PIX', wid, 'pending');

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Saque solicitado', 'Sua solicitação de saque de R$ ' || _amount || ' foi registrada.', 'withdrawal');
  RETURN wid;
END;
$$;

-- Revoke public execution
REVOKE EXECUTE ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) FROM public;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.credit_points(uuid, bigint, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) TO authenticated, service_role;