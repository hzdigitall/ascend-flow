CREATE OR REPLACE FUNCTION public.expire_due_plans(_user uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.user_plans
     WHERE status = 'active'::user_plan_status
       AND expires_at IS NOT NULL
       AND expires_at <= now()
       AND (_user IS NULL OR user_id = _user)
     FOR UPDATE
  LOOP
    UPDATE public.user_plans SET status = 'expired'::user_plan_status, updated_at = now() WHERE id = r.id;

    -- devolve o montante investido para o saldo principal (disponível para saque)
    IF COALESCE(r.price, 0) > 0 THEN
      PERFORM public.credit_wallet(r.user_id, r.price, 'main', 'adjustment',
        'Retorno do montante do plano ' || r.plan_name, r.id);
    END IF;

    -- bônus de cadastro de R$ 30, liberado uma única vez por usuário
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions
       WHERE user_id = r.user_id
         AND description = 'Bônus de cadastro'
    ) THEN
      PERFORM public.credit_wallet(r.user_id, 30, 'main', 'bonus', 'Bônus de cadastro', r.id);
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (r.user_id, 'Plano expirado',
            'Seu plano ' || r.plan_name || ' venceu. O montante investido foi liberado no seu saldo principal.', 'plan');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$fn$;