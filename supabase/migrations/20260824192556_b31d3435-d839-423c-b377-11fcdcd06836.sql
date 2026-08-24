-- =========================================================
-- ConnectPay integration: enums, tables, columns, RPCs, RLS
-- =========================================================

ALTER TYPE public.wallet_type ADD VALUE IF NOT EXISTS 'usdt';
ALTER TYPE public.tx_category ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE public.tx_category ADD VALUE IF NOT EXISTS 'reversal';
ALTER TYPE public.withdrawal_status ADD VALUE IF NOT EXISTS 'submitting';
ALTER TYPE public.withdrawal_status ADD VALUE IF NOT EXISTS 'failed';

-- ---------------------------------------------------------
-- payment_gateways
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'production',
  base_url text NOT NULL DEFAULT 'https://api.connectpay.vc',
  webhook_base_url text,
  credentials_configured boolean NOT NULL DEFAULT false,
  credential_last_four text,
  connection_status text NOT NULL DEFAULT 'not_configured',
  pix_cashin_enabled boolean NOT NULL DEFAULT true,
  pix_cashout_enabled boolean NOT NULL DEFAULT true,
  usdt_deposit_enabled boolean NOT NULL DEFAULT true,
  usdt_withdraw_enabled boolean NOT NULL DEFAULT true,
  last_connection_test timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateways_select_auth" ON public.payment_gateways
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_payment_gateways_updated BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_gateways (provider, active, environment, base_url, credentials_configured, connection_status)
VALUES ('connectpay', false, 'production', 'https://api.connectpay.vc', false, 'not_configured')
ON CONFLICT (provider) DO NOTHING;

-- ---------------------------------------------------------
-- gateway_credentials (server-only, encrypted at rest)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gateway_credentials (
  provider text NOT NULL PRIMARY KEY REFERENCES public.payment_gateways(provider) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  last_four text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.gateway_credentials FROM anon, authenticated;
GRANT ALL ON public.gateway_credentials TO service_role;
ALTER TABLE public.gateway_credentials ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: unreachable through the Data API

CREATE TRIGGER trg_gateway_credentials_updated BEFORE UPDATE ON public.gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- deposits
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('pix','crypto')),
  currency text NOT NULL CHECK (currency IN ('BRL','USDT')),
  network text,
  amount numeric(20,8) NOT NULL CHECK (amount > 0),
  net_amount numeric(20,8),
  gateway_fee numeric(20,8) NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'connectpay',
  provider_transaction_id text,
  external_id text NOT NULL UNIQUE,
  idempotency_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  pix_payload text,
  deposit_address text,
  qr_code text,
  tx_hash text,
  failure_reason text,
  expires_at timestamptz,
  credited_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deposits_provider_tx_uniq
  ON public.deposits (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS deposits_user_created_idx ON public.deposits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON public.deposits (status);

GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposits_select_own" ON public.deposits
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TRIGGER trg_deposits_updated BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- payment_webhook_events
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'connectpay',
  provider_transaction_id text,
  external_id text,
  event_type text NOT NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text
);

CREATE INDEX IF NOT EXISTS webhook_events_tx_idx ON public.payment_webhook_events (provider_transaction_id);
CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON public.payment_webhook_events (received_at DESC);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_admin_select" ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------
-- wallets: USDT + reserved balances
-- ---------------------------------------------------------
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS usdt_balance numeric(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usdt_reserved numeric(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_balance numeric(14,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------
-- wallet_transactions: ledger metadata
-- ---------------------------------------------------------
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------
-- withdrawals: multi-method payout fields
-- ---------------------------------------------------------
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS network text,
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.withdrawals ALTER COLUMN pix_key_type DROP NOT NULL;
ALTER TABLE public.withdrawals ALTER COLUMN pix_key_value DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_idem_uniq ON public.withdrawals (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_provider_tx_uniq
  ON public.withdrawals (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- =========================================================
-- RPC: deposit credit (idempotent, atomic)
-- =========================================================
CREATE OR REPLACE FUNCTION public.credit_deposit(_deposit uuid, _payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d RECORD; before_v NUMERIC; after_v NUMERIC; w TEXT;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = _deposit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Depósito não encontrado'; END IF;
  IF d.credited_at IS NOT NULL THEN RETURN false; END IF;

  IF d.currency = 'USDT' THEN
    w := 'usdt';
    SELECT usdt_balance INTO before_v FROM public.wallets WHERE user_id = d.user_id FOR UPDATE;
    after_v := COALESCE(before_v,0) + d.amount;
    UPDATE public.wallets SET usdt_balance = after_v, updated_at = now() WHERE user_id = d.user_id;
  ELSE
    w := 'main';
    SELECT main_balance INTO before_v FROM public.wallets WHERE user_id = d.user_id FOR UPDATE;
    after_v := COALESCE(before_v,0) + d.amount;
    UPDATE public.wallets SET main_balance = after_v, updated_at = now() WHERE user_id = d.user_id;
  END IF;

  UPDATE public.deposits
     SET status = 'credited', credited_at = now(),
         metadata = COALESCE(metadata,'{}'::jsonb) || COALESCE(_payload,'{}'::jsonb)
   WHERE id = d.id;

  INSERT INTO public.wallet_transactions
    (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
     description, reference_id, reference_type, status, currency, provider)
  VALUES (d.user_id, w::wallet_type, 'in'::tx_direction, 'deposit'::tx_category, d.amount,
          COALESCE(before_v,0), after_v,
          'Depósito ' || d.currency || COALESCE(' ' || d.network, '') || ' confirmado',
          d.id, 'deposit', 'completed'::tx_status, d.currency, d.provider);

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (d.user_id, 'Depósito confirmado',
          'Seu depósito de ' || trim(to_char(d.amount, 'FM999999990.00')) || ' ' || d.currency || ' foi creditado.',
          'payment');
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.credit_deposit(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid, jsonb) TO service_role;

-- =========================================================
-- RPC: withdrawal request with balance reservation
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(
  _user uuid, _amount numeric, _wallet text, _method text, _currency text,
  _network text, _key_type text, _key text, _address text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            'crypto', 'USDT', 'BEP20', trim(_address), 'connectpay', '{}'::jsonb)
    RETURNING id INTO wid;
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
  END IF;

  IF _currency = 'USDT' THEN
    INSERT INTO public.wallet_transactions
      (user_id, wallet_type, direction, category, amount, balance_before, balance_after,
       description, reference_id, reference_type, status, currency, provider)
    VALUES (_user, 'usdt'::wallet_type, 'out'::tx_direction, 'withdrawal'::tx_category, _amount,
            bal, after_v, 'Solicitação de saque USDT (BEP20)', wid, 'withdrawal',
            'pending'::tx_status, 'USDT', 'connectpay');
  END IF;

  UPDATE public.withdrawals
     SET external_id = wid::text, idempotency_key = 'connectpay-withdraw-' || wid::text
   WHERE id = wid;

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Saque solicitado',
          'Sua solicitação de saque de ' || trim(to_char(_amount,'FM999999990.00')) || ' ' || _currency ||
          ' foi registrada e aguarda aprovação.', 'withdrawal');
  RETURN wid;
END; $$;

REVOKE ALL ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_v2(uuid, numeric, text, text, text, text, text, text, text) TO service_role;

-- =========================================================
-- RPC: atomic transition pending -> submitting (double-click guard)
-- =========================================================
CREATE OR REPLACE FUNCTION public.withdrawal_begin_submission(_admin uuid, _wid uuid)
RETURNS public.withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE w public.withdrawals;
BEGIN
  UPDATE public.withdrawals
     SET status = 'submitting'::withdrawal_status,
         reviewed_at = now(), reviewed_by = _admin, submitted_at = now(),
         idempotency_key = COALESCE(idempotency_key, 'connectpay-withdraw-' || _wid::text),
         external_id = COALESCE(external_id, _wid::text)
   WHERE id = _wid AND status = 'pending'::withdrawal_status
  RETURNING * INTO w;

  IF w.id IS NULL THEN
    RAISE EXCEPTION 'Este saque não está mais aguardando aprovação.';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, new_value)
  VALUES (_admin, 'withdrawal_submitting', 'withdrawals', _wid,
          jsonb_build_object('amount', w.amount, 'currency', w.currency, 'method', w.method));
  RETURN w;
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_begin_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_begin_submission(uuid, uuid) TO service_role;

-- =========================================================
-- RPC: mark provider processing
-- =========================================================
CREATE OR REPLACE FUNCTION public.withdrawal_mark_processing(_wid uuid, _provider_tx text, _payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.withdrawals
     SET status = 'processing'::withdrawal_status,
         provider_transaction_id = COALESCE(_provider_tx, provider_transaction_id),
         metadata = COALESCE(metadata,'{}'::jsonb) || COALESCE(_payload,'{}'::jsonb)
   WHERE id = _wid AND status IN ('submitting'::withdrawal_status, 'pending'::withdrawal_status, 'processing'::withdrawal_status);
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_mark_processing(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_mark_processing(uuid, text, jsonb) TO service_role;

-- =========================================================
-- RPC: complete withdrawal (idempotent)
-- =========================================================
CREATE OR REPLACE FUNCTION public.withdrawal_complete(_wid uuid, _provider_tx text, _tx_hash text, _payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF w.currency = 'USDT' THEN
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
          'Seu saque de ' || trim(to_char(w.net_amount,'FM999999990.00')) || ' ' || w.currency || ' foi concluído.',
          'withdrawal');
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_complete(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_complete(uuid, text, text, jsonb) TO service_role;

-- =========================================================
-- RPC: fail / cancel withdrawal, releasing reserved funds once
-- =========================================================
CREATE OR REPLACE FUNCTION public.withdrawal_release(_wid uuid, _status text, _reason text, _payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF w.currency = 'USDT' THEN
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
          'completed'::tx_status, w.currency, w.provider);

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (w.user_id, 'Saque não concluído',
          COALESCE(_reason, 'Sua solicitação de saque não foi concluída e o valor foi devolvido ao seu saldo.'),
          'withdrawal');
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_release(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_release(uuid, text, text, jsonb) TO service_role;

-- =========================================================
-- RPC: admin rejection (only from pending)
-- =========================================================
CREATE OR REPLACE FUNCTION public.withdrawal_reject_admin(_admin uuid, _wid uuid, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE st withdrawal_status; ok boolean;
BEGIN
  SELECT status INTO st FROM public.withdrawals WHERE id = _wid FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF st <> 'pending'::withdrawal_status THEN
    RAISE EXCEPTION 'Somente saques aguardando aprovação podem ser rejeitados.';
  END IF;

  UPDATE public.withdrawals SET reviewed_at = now(), reviewed_by = _admin WHERE id = _wid;
  ok := public.withdrawal_release(_wid, 'rejected', _reason, jsonb_build_object('rejected_by', _admin));

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, old_value, new_value)
  VALUES (_admin, 'withdrawal_rejected', 'withdrawals', _wid,
          jsonb_build_object('status', st), jsonb_build_object('reason', _reason));
  RETURN ok;
END; $$;

REVOKE ALL ON FUNCTION public.withdrawal_reject_admin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_reject_admin(uuid, uuid, text) TO service_role;

-- =========================================================
-- Fix argument order bug in legacy process_withdrawal refund
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_withdrawal(_admin uuid, _wid uuid, _action text, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE w RECORD;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _wid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF w.status IN ('paid','rejected','cancelled') THEN RAISE EXCEPTION 'Saque já finalizado'; END IF;

  IF _action = 'approve' THEN
    UPDATE public.withdrawals SET status='processing' WHERE id=_wid;
  ELSIF _action = 'pay' THEN
    PERFORM public.withdrawal_complete(_wid, w.provider_transaction_id, w.tx_hash, jsonb_build_object('paid_by', _admin));
  ELSIF _action = 'reject' THEN
    PERFORM public.withdrawal_release(_wid, 'rejected', _reason, jsonb_build_object('rejected_by', _admin));
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, old_value, new_value)
  VALUES (_admin, 'withdrawal_' || _action, 'withdrawals', _wid, jsonb_build_object('status', w.status), jsonb_build_object('reason', _reason));
  RETURN true;
END; $$;

-- =========================================================
-- Deposit/withdraw default settings (preserve existing values)
-- =========================================================
INSERT INTO public.settings (key, value, is_public) VALUES
  ('deposit_min', '20'::jsonb, true),
  ('deposit_max', '50000'::jsonb, true),
  ('usdt_deposit_min', '10'::jsonb, true),
  ('usdt_withdraw_min', '10'::jsonb, true),
  ('usdt_withdraw_max', '100000'::jsonb, true),
  ('usdt_withdraw_fee_percent', '0'::jsonb, true)
ON CONFLICT (key) DO NOTHING;