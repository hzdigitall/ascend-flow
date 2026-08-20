
-- 1. Atualizar Níveis de Indicação (8 Níveis)
UPDATE public.settings 
SET value = '{"1":12,"2":5,"3":3,"4":2,"5":1,"6":1,"7":1,"8":1}'::jsonb
WHERE key = 'referral_rates';

-- 2. Atualizar Taxa de Saque (2%)
UPDATE public.settings 
SET value = '2'::jsonb
WHERE key = 'withdraw_fee_percent';

-- 3. Atualizar Nome da Plataforma
UPDATE public.settings 
SET value = '"Arena Saúde"'::jsonb
WHERE key = 'platform_name';

-- 4. Adicionar configuração de Bônus de Cadastro (Voucher R$ 30)
INSERT INTO public.settings (key, value, is_public)
VALUES ('signup_bonus_voucher', '30', true)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Atualizar Planos Arena Saúde
DELETE FROM public.plans;

INSERT INTO public.plans (name, description, price, points, benefits, validity_days, sort_order) VALUES
  ('Iniciante', '3,50% ao dia. Dobra em 29 dias úteis.', 50.00, 5, ARRAY['Rende até R$ 100,00', 'Pontos Arena', 'Pagamento PIX'], 45, 1),
  ('Intermediário', '4,50% ao dia. Dobra em 23 dias úteis.', 250.00, 25, ARRAY['Rende até R$ 500,00', 'Pontos Arena', 'Pagamento PIX'], 45, 2),
  ('Avançado', '6,50% ao dia. Dobra em 16 dias úteis.', 500.00, 50, ARRAY['Rende até R$ 1.000,00', 'Pontos Arena', 'Pagamento PIX'], 45, 3),
  ('Profissional', '6,50% ao dia. Dobra em 16 dias úteis.', 1000.00, 100, ARRAY['Rende até R$ 2.000,00', 'Pontos Arena', 'Pagamento PIX'], 45, 4),
  ('Elite', '7,50% ao dia. Dobra em 14 dias úteis.', 5000.00, 500, ARRAY['Rende até R$ 10.000,00', 'Pontos Arena', 'Pagamento PIX'], 45, 5);

-- 6. Atualizar Função confirm_payment para processar 8 NÍVEIS
CREATE OR REPLACE FUNCTION public.confirm_payment(_payment UUID, _payload JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay RECORD; pl RECORD; sponsor UUID; lvl INT; pct NUMERIC; amt NUMERIC; rates JSONB; cur UUID;
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

  INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, description, reference_id)
  VALUES (pay.user_id, 'main', 'out', 'payment', pay.amount, 'Compra de plano', pay.id);

  -- BUSCAR TAXAS ATUALIZADAS (8 NÍVEIS)
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
          PERFORM public.credit_wallet(cur, 'referral', amt, 'referral', 'Comissão nível ' || lvl, pay.id);
          INSERT INTO public.notifications (user_id, title, body, type)
          VALUES (cur, 'Comissão recebida', 'Você recebeu R$ ' || amt || ' de comissão (nível ' || lvl || ').', 'referral');
        END IF;
      END IF;
    END IF;
    SELECT sponsor_id INTO cur FROM public.profiles WHERE id = cur;
    lvl := lvl + 1;
  END LOOP;

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (pay.user_id, 'Pagamento aprovado', 'Seu pagamento foi confirmado e o plano foi ativado.', 'payment');
  RETURN true;
END; $$;

-- 7. Lógica de Rendimento Diário Automático (ROI)
CREATE TABLE IF NOT EXISTS public.daily_roi_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_plan_id UUID REFERENCES public.user_plans(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_roi_logs TO authenticated;
GRANT ALL ON public.daily_roi_logs TO service_role;

CREATE OR REPLACE FUNCTION public.process_daily_roi()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC;
BEGIN
  FOR r IN 
    SELECT up.*, p.price as plan_price, p.name as plan_name
    FROM public.user_plans up 
    JOIN public.plans p ON p.id = up.plan_id
    WHERE up.status = 'active'
  LOOP
    -- Determinar % com base no nome do plano (seguindo o PDF)
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
      max_amt := r.plan_price * 2.0; -- Dobra o investimento
      
      -- Verificar quanto já rendeu este plano específico
      SELECT COALESCE(SUM(amount), 0) INTO current_total 
      FROM public.wallet_transactions 
      WHERE user_id = r.user_id AND reference_id = r.id AND category = 'earning';

      IF (current_total + roi_amt) >= max_amt THEN
        roi_amt := max_amt - current_total;
        -- Finalizar o plano pois dobrou
        UPDATE public.user_plans SET status = 'expired', updated_at = now() WHERE id = r.id;
      END IF;

      IF roi_amt > 0 THEN
        PERFORM public.credit_wallet(r.user_id, 'earnings', roi_amt, 'earning', 'Rendimento diário: ' || r.plan_name, r.id);
        INSERT INTO public.daily_roi_logs (user_plan_id, amount) VALUES (r.id, roi_amt);
      END IF;
    END IF;
  END LOOP;
END; $$;

-- 8. RLS e permissões para logs de ROI
ALTER TABLE public.daily_roi_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roi_logs_self_read" ON public.daily_roi_logs 
FOR SELECT TO authenticated 
USING (
    user_plan_id IN (SELECT id FROM public.user_plans WHERE user_id = auth.uid()) 
    OR public.is_admin()
);

-- 9. Restringir execução de funções SECURITY DEFINER (Segurança)
REVOKE ALL ON FUNCTION public.process_daily_roi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_roi() TO service_role;

REVOKE ALL ON FUNCTION public.confirm_payment(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.get_setting(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting(TEXT, JSONB) TO service_role;
