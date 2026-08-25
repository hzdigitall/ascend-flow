CREATE OR REPLACE FUNCTION public.credit_wallet(_user uuid, _amount numeric, _wallet text, _cat text, _desc text DEFAULT NULL::text, _ref uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  VALUES (_user, _wallet::wallet_type, 'in'::tx_direction, _cat::tx_category, _amount, before_v, after_v, _desc, _ref);
END;
$function$;