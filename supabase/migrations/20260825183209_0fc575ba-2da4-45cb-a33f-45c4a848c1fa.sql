-- 1) Novas colunas de estado da gateway
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ipn_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_auth_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asset_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payment_gateways SET display_name = 'ConnectPay' WHERE provider = 'connectpay' AND display_name = '';

INSERT INTO public.payment_gateways (provider, display_name, active, environment, base_url,
  credentials_configured, connection_status, pix_cashin_enabled, pix_cashout_enabled,
  usdt_deposit_enabled, usdt_withdraw_enabled)
VALUES ('nowpayments', 'NOWPayments', false, 'production', 'https://api.nowpayments.io',
  false, 'not_configured', false, false, false, false)
ON CONFLICT (provider) DO NOTHING;

-- 2) Cofre de credenciais por chave (server-only)
CREATE TABLE IF NOT EXISTS public.gateway_secrets (
  provider text NOT NULL REFERENCES public.payment_gateways(provider) ON DELETE CASCADE,
  key_name text NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  last_four text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, key_name)
);
GRANT ALL ON public.gateway_secrets TO service_role;
ALTER TABLE public.gateway_secrets ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_gateway_secrets_updated ON public.gateway_secrets;
CREATE TRIGGER trg_gateway_secrets_updated BEFORE UPDATE ON public.gateway_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Depósitos: campos NOWPayments
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS purchase_id text,
  ADD COLUMN IF NOT EXISTS pay_address text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS expected_amount numeric,
  ADD COLUMN IF NOT EXISTS actually_paid numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS deposits_provider_tx_unique
  ON public.deposits (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS deposits_order_id_idx ON public.deposits (order_id);
CREATE INDEX IF NOT EXISTS deposits_user_created_idx ON public.deposits (user_id, created_at DESC);

-- 4) Saques: campos de payout
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS provider_payout_id text,
  ADD COLUMN IF NOT EXISTS batch_withdrawal_id text,
  ADD COLUMN IF NOT EXISTS unique_external_id text;

CREATE INDEX IF NOT EXISTS withdrawals_batch_idx ON public.withdrawals (batch_withdrawal_id);
CREATE INDEX IF NOT EXISTS withdrawals_payout_idx ON public.withdrawals (provider_payout_id);
CREATE INDEX IF NOT EXISTS withdrawals_unique_ext_idx ON public.withdrawals (unique_external_id);

-- 5) Webhook events: assinatura validada
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS signature_valid boolean;
CREATE INDEX IF NOT EXISTS pwe_provider_tx_idx
  ON public.payment_webhook_events (provider, provider_transaction_id);

-- 6) Roteamento de provedor: novos saques USDT vão para a NOWPayments (PIX intacto)
CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(_user uuid, _amount numeric, _wallet text, _method text, _currency text, _network text, _key_type text, _key text, _address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE bal NUMERIC; min_v NUMERIC; max_v NUMERIC; fee_pct NUMERIC; fee NUMERIC; net NUMERIC; wid UUID; after_v NUMERIC;
BEGIN
  IF _currency = 'USDT' THEN
    IF _wallet <> 'usdt' THEN RAISE EXCEPTION 'Carteira inválida para saque USDT'; END IF;
    IF _network <> 'BEP20' THEN RAISE EXCEPTION 'Rede inválida. Utilize BEP20.'; END IF;
    IF _address IS NULL OR length(trim(_address)) < 20 THEN RAISE EXCEPTION 'Endereço de carteira inválido'; END IF;

    min_v := COALESCE((public.get_setting('usdt_withdraw_min','10'::jsonb))::numeric, 10);
    max_v := COALESCE((public.get_setting('usdt_withdraw_max','100000'::jsonb))::numeric, 100000);
    fee_pct := COALESCE((public.get_setting('usdt_withdraw_fee_percent','0'::jsonb))::numeric, 0);
    IF _amount < min_v THEN RAISE EXCEPTION 'Valor mínimo de saque: % USDT', min_v; END IF;
    IF _amount > max_v THEN RAISE EXCEPTION 'Valor máximo de saque: % USDT', max_v; END IF;

    SELECT usdt_balance INTO bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
    IF bal IS NULL OR bal < _amount THEN RAISE EXCEPTION 'Saldo USDT insuficiente'; END IF;

    fee := round(_amount * fee_pct / 100.0, 8);
    net := _amount - fee;
    after_v := bal - _amount;

    UPDATE public.wallets
       SET usdt_balance = after_v, usdt_reserved = usdt_reserved + _amount, updated_at = now()
     WHERE user_id = _user;

    INSERT INTO public.withdrawals
      (user_id, wallet_type, amount, fee, net_amount, status, method, currency, network,
       wallet_address, provider, metadata)
    VALUES (_user, 'usdt'::wallet_type, _amount, fee, net, 'pending'::withdrawal_status,
            'crypto', 'USDT', 'BEP20', trim(_address), 'nowpayments',
            jsonb_build_object('pay_currency','usdtbsc'))
    RETURNING id INTO wid;

    INSERT INTO public.wallet_transactions
      (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
       description, reference_id, reference_type, status, currency, provider)
    VALUES (_user, 'usdt'::wallet_type, 'out'::tx_direction, 'withdrawal'::tx_category, _amount,
            bal, after_v, 'Solicitação de saque USDT (BEP20)', wid, 'withdrawal',
            'pending'::tx_status, 'USDT', 'nowpayments');

    UPDATE public.withdrawals
       SET external_id = wid::text,
           unique_external_id = 'arena-payout-' || wid::text,
           idempotency_key = 'nowpayments-payout-' || wid::text
     WHERE id = wid;
  ELSE
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
      reserved_balance = reserved_balance + _amount,
      updated_at = now()
    WHERE user_id = _user;

    INSERT INTO public.withdrawals
      (user_id, wallet_type, amount, fee, net_amount, pix_key_type, pix_key_value, status,
       method, currency, provider, metadata)
    VALUES (_user, _wallet::wallet_type, _amount, fee, net, _key_type::pix_key_type, trim(_key),
            'pending'::withdrawal_status, 'pix', 'BRL', 'connectpay', '{}'::jsonb)
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
          'Sua solicitação de saque de ' || trim(to_char(_amount,'FM999999990.00')) || ' ' || _currency ||
          ' foi registrada e aguarda aprovação.', 'withdrawal');
  RETURN wid;
END; $function$;

REVOKE ALL ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) TO service_role;