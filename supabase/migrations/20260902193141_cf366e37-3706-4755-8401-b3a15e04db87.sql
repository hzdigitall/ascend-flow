-- 1) Rotinas sensíveis: somente o servidor (service_role) pode executar
DO $$
DECLARE fn RECORD; names TEXT[] := ARRAY[
  'admin_adjust_balance','admin_adjust_career_points','admin_delete_user_data','admin_grant_plan',
  'admin_run_bla','admin_set_career_rank','confirm_payment','credit_deposit','credit_points',
  'credit_wallet','create_plan_checkout','create_plan_payment','process_withdrawal','process_daily_roi',
  'process_monthly_bla','purchase_plan_with_balance','redeem_product','request_withdrawal',
  'request_withdrawal_v2','withdrawal_auto_begin_submission','withdrawal_begin_submission',
  'withdrawal_complete','withdrawal_mark_processing','withdrawal_reject_admin','withdrawal_release',
  'add_career_points','expire_due_plans','notify_expiring_plans','admin_run_bla'];
BEGIN
  FOR fn IN
    SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- 2) Pagamento só pode virar "pago" com comprovação
CREATE OR REPLACE FUNCTION public.guard_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status::text,'') <> 'paid' THEN
    IF NEW.gateway IN ('balance','admin') THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.deposits d
               WHERE d.payment_id = NEW.id AND d.status IN ('credited','finished','confirmed')) THEN
      RETURN NEW;
    END IF;
    IF NEW.external_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.payment_webhook_events w
      WHERE w.external_id = NEW.external_id AND COALESCE(w.signature_valid, true)
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Pagamento sem comprovação de recebimento não pode ser confirmado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_payment_paid ON public.payments;
CREATE TRIGGER trg_guard_payment_paid BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_paid();

-- 3) Plano só ativa com pagamento pago
CREATE OR REPLACE FUNCTION public.guard_user_plan_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND COALESCE(OLD.status::text,'') <> 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.user_plan_id = NEW.id AND p.status = 'paid'
    ) THEN
      RAISE EXCEPTION 'Plano não pode ser ativado sem pagamento confirmado';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_user_plan_activation ON public.user_plans;
CREATE TRIGGER trg_guard_user_plan_activation BEFORE UPDATE ON public.user_plans
FOR EACH ROW EXECUTE FUNCTION public.guard_user_plan_activation();

-- 4) Contas bloqueadas não movimentam nada
CREATE OR REPLACE FUNCTION public.guard_blocked_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = NEW.user_id AND pr.blocked) THEN
    RAISE EXCEPTION 'Conta bloqueada: operação não permitida';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_withdrawals ON public.withdrawals;
CREATE TRIGGER trg_block_withdrawals BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_account();

DROP TRIGGER IF EXISTS trg_block_user_plans ON public.user_plans;
CREATE TRIGGER trg_block_user_plans BEFORE INSERT ON public.user_plans
FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_account();

DROP TRIGGER IF EXISTS trg_block_orders ON public.orders;
CREATE TRIGGER trg_block_orders BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_account();

-- 5) Limite de 1 saque por dia (horário de Brasília), reforçado no banco
CREATE OR REPLACE FUNCTION public.guard_daily_withdrawal_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.withdrawals w
    WHERE w.user_id = NEW.user_id
      AND w.status NOT IN ('rejected','cancelled','failed')
      AND (w.created_at AT TIME ZONE 'America/Sao_Paulo')::date
          = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) THEN
    RAISE EXCEPTION 'Limite de 1 saque por dia atingido';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_daily_withdrawal_limit ON public.withdrawals;
CREATE TRIGGER trg_daily_withdrawal_limit BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_daily_withdrawal_limit();

-- 6) Saldos não podem ficar negativos
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_usdt_balance_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_usdt_balance_check CHECK (usdt_balance >= 0);
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_usdt_reserved_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_usdt_reserved_check CHECK (usdt_reserved >= 0);
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_reserved_balance_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_reserved_balance_check CHECK (reserved_balance >= 0);