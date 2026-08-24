CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_admin uuid, _user uuid, _wallet text, _amount numeric, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE before_v NUMERIC; after_v NUMERIC;
BEGIN
  IF _wallet NOT IN ('main','earnings','referral','usdt') THEN RAISE EXCEPTION 'Carteira inválida'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'Informe um valor diferente de zero'; END IF;

  SELECT CASE _wallet
           WHEN 'main' THEN main_balance
           WHEN 'earnings' THEN earnings_balance
           WHEN 'referral' THEN referral_balance
           ELSE usdt_balance END
    INTO before_v FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF before_v IS NULL THEN RAISE EXCEPTION 'Carteira do usuário não encontrada'; END IF;

  after_v := before_v + _amount;
  IF after_v < 0 THEN RAISE EXCEPTION 'Saldo insuficiente para debitar este valor'; END IF;

  UPDATE public.wallets SET
    main_balance = CASE WHEN _wallet='main' THEN after_v ELSE main_balance END,
    earnings_balance = CASE WHEN _wallet='earnings' THEN after_v ELSE earnings_balance END,
    referral_balance = CASE WHEN _wallet='referral' THEN after_v ELSE referral_balance END,
    usdt_balance = CASE WHEN _wallet='usdt' THEN after_v ELSE usdt_balance END,
    updated_at = now()
  WHERE user_id = _user;

  INSERT INTO public.wallet_transactions
    (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
     description, status, currency, metadata)
  VALUES (_user, _wallet::wallet_type,
          (CASE WHEN _amount > 0 THEN 'in' ELSE 'out' END)::tx_direction,
          'adjustment'::tx_category, abs(_amount), before_v, after_v,
          'Ajuste manual do administrador: ' || _reason, 'completed'::tx_status,
          CASE WHEN _wallet='usdt' THEN 'USDT' ELSE 'BRL' END,
          jsonb_build_object('admin_id', _admin));

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, old_value, new_value)
  VALUES (_admin, 'balance_adjusted', 'wallets', _user,
          jsonb_build_object('balance', before_v),
          jsonb_build_object('wallet', _wallet, 'amount', _amount, 'balance', after_v, 'reason', _reason));

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Saldo ajustado',
          'Seu saldo foi ajustado pela administração: ' || trim(to_char(_amount,'FM999999990.00')) || '. Motivo: ' || _reason,
          'payment');
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, uuid, text, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_grant_plan(_admin uuid, _user uuid, _plan uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p RECORD; up UUID; pay UUID;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado'; END IF;

  INSERT INTO public.user_plans (user_id, plan_id, plan_name, price, points_granted, status, activated_at, expires_at)
  VALUES (_user, p.id, p.name, p.price, p.points, 'active', now(),
          now() + (COALESCE(p.validity_days,30) || ' days')::interval)
  RETURNING id INTO up;

  INSERT INTO public.payments (user_id, plan_id, user_plan_id, amount, status, gateway, paid_at)
  VALUES (_user, p.id, up, p.price, 'paid', 'admin', now()) RETURNING id INTO pay;

  INSERT INTO public.payment_events (payment_id, event_type, payload)
  VALUES (pay, 'paid', jsonb_build_object('source','admin','admin_id',_admin,'reason',_reason,'commissions','skipped'));

  IF p.points > 0 THEN
    PERFORM public.credit_points(_user, p.points::bigint, 'adjustment', 'Pontos do plano ' || p.name || ' (liberado pelo admin)', pay);
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'plan_granted_manually', 'user_plans', up,
          jsonb_build_object('plan', p.name, 'user_id', _user, 'reason', _reason, 'commissions', 'skipped'));

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Plano ativado', 'O plano ' || p.name || ' foi ativado na sua conta pela administração.', 'payment');
  RETURN up;
END; $$;

REVOKE ALL ON FUNCTION public.admin_grant_plan(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_plan(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_admin uuid, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, old_value)
  VALUES (_admin, 'user_deleted', 'profiles', _user,
          (SELECT jsonb_build_object('email', email, 'full_name', full_name) FROM public.profiles WHERE id = _user));

  UPDATE public.profiles SET sponsor_id = NULL WHERE sponsor_id = _user;
  DELETE FROM public.daily_roi_logs WHERE user_plan_id IN (SELECT id FROM public.user_plans WHERE user_id = _user);
  DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE user_id = _user);
  DELETE FROM public.orders WHERE user_id = _user;
  DELETE FROM public.commissions WHERE sponsor_id = _user OR referred_id = _user;
  DELETE FROM public.payment_events WHERE payment_id IN (SELECT id FROM public.payments WHERE user_id = _user);
  DELETE FROM public.payments WHERE user_id = _user;
  DELETE FROM public.user_plans WHERE user_id = _user;
  DELETE FROM public.referrals WHERE sponsor_id = _user OR referred_id = _user;
  DELETE FROM public.withdrawals WHERE user_id = _user;
  DELETE FROM public.deposits WHERE user_id = _user;
  DELETE FROM public.wallet_transactions WHERE user_id = _user;
  DELETE FROM public.points_transactions WHERE user_id = _user;
  DELETE FROM public.pix_keys WHERE user_id = _user;
  DELETE FROM public.notifications WHERE user_id = _user;
  DELETE FROM public.wallets WHERE user_id = _user;
  DELETE FROM public.user_roles WHERE user_id = _user;
  DELETE FROM public.profiles WHERE id = _user;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid, uuid) TO service_role;