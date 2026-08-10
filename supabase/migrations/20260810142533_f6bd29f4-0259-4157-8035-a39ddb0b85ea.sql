
-- ===== restringir execução de funções internas =====
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- separar políticas públicas (anon não executa is_admin)
DROP POLICY "plans_public_read" ON public.plans;
CREATE POLICY "plans_anon_read" ON public.plans FOR SELECT TO anon USING (active);
CREATE POLICY "plans_auth_read" ON public.plans FOR SELECT TO authenticated USING (active OR public.is_admin());
DROP POLICY "cats_public_read" ON public.product_categories;
CREATE POLICY "cats_anon_read" ON public.product_categories FOR SELECT TO anon USING (active);
CREATE POLICY "cats_auth_read" ON public.product_categories FOR SELECT TO authenticated USING (active OR public.is_admin());
DROP POLICY "products_public_read" ON public.products;
CREATE POLICY "products_anon_read" ON public.products FOR SELECT TO anon USING (active);
CREATE POLICY "products_auth_read" ON public.products FOR SELECT TO authenticated USING (active OR public.is_admin());
DROP POLICY "banners_public_read" ON public.banners;
CREATE POLICY "banners_anon_read" ON public.banners FOR SELECT TO anon
  USING (active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "banners_auth_read" ON public.banners FOR SELECT TO authenticated
  USING ((active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())) OR public.is_admin());
DROP POLICY "settings_public_read" ON public.settings;
CREATE POLICY "settings_anon_read" ON public.settings FOR SELECT TO anon USING (is_public);
CREATE POLICY "settings_auth_read" ON public.settings FOR SELECT TO authenticated USING (is_public OR public.is_admin());

-- ===== helpers =====
CREATE OR REPLACE FUNCTION public.get_setting(_key TEXT, _default JSONB)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM public.settings WHERE key = _key), _default);
$$;
REVOKE ALL ON FUNCTION public.get_setting(TEXT, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_wallet(_user UUID, _wallet public.wallet_type, _amount NUMERIC, _cat public.tx_category, _desc TEXT, _ref UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  VALUES (_user, _wallet, 'in', _cat, _amount, before_v, after_v, _desc, _ref);
END; $$;
REVOKE ALL ON FUNCTION public.credit_wallet(UUID, public.wallet_type, NUMERIC, public.tx_category, TEXT, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_points(_user UUID, _points BIGINT, _cat public.tx_category, _desc TEXT, _ref UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE after_v BIGINT;
BEGIN
  IF _points = 0 THEN RETURN; END IF;
  UPDATE public.wallets SET points_balance = points_balance + _points, updated_at = now()
    WHERE user_id = _user RETURNING points_balance INTO after_v;
  INSERT INTO public.points_transactions (user_id, direction, points, balance_after, category, description, reference_id)
  VALUES (_user, CASE WHEN _points > 0 THEN 'in' ELSE 'out' END, abs(_points), after_v, _cat, _desc, _ref);
END; $$;
REVOKE ALL ON FUNCTION public.credit_points(UUID, BIGINT, public.tx_category, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- ===== criar pagamento PIX (pendente) =====
CREATE OR REPLACE FUNCTION public.create_plan_payment(_user UUID, _plan UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD; up UUID; pay UUID; mins INT;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível'; END IF;
  mins := COALESCE((public.get_setting('pix_expiration_minutes', '30'::jsonb))::int, 30);
  INSERT INTO public.user_plans (user_id, plan_id, plan_name, price, points_granted, status)
  VALUES (_user, p.id, p.name, p.price, p.points, 'pending') RETURNING id INTO up;
  INSERT INTO public.payments (user_id, plan_id, user_plan_id, amount, status, gateway, expires_at)
  VALUES (_user, p.id, up, p.price, 'pending', COALESCE(public.get_setting('pix_gateway','"internal"'::jsonb) #>> '{}','internal'), now() + (mins || ' minutes')::interval)
  RETURNING id INTO pay;
  INSERT INTO public.payment_events (payment_id, event_type, payload) VALUES (pay, 'created', jsonb_build_object('plan', p.name));
  RETURN pay;
END; $$;
REVOKE ALL ON FUNCTION public.create_plan_payment(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ===== confirmar pagamento (somente servidor/webhook) =====
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

  rates := public.get_setting('referral_rates', '{"1":10,"2":5,"3":2}'::jsonb);
  SELECT sponsor_id INTO cur FROM public.profiles WHERE id = pay.user_id;
  lvl := 1;
  WHILE cur IS NOT NULL AND lvl <= 3 LOOP
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
REVOKE ALL ON FUNCTION public.confirm_payment(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ===== saque =====
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user UUID, _wallet public.wallet_type, _amount NUMERIC, _key_type public.pix_key_type, _key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  VALUES (_user, _wallet, _amount, fee, net, _key_type, _key, 'pending') RETURNING id INTO wid;

  INSERT INTO public.wallet_transactions (user_id, wallet_type, direction, category, amount, balance_before, balance_after, description, reference_id, status)
  VALUES (_user, _wallet, 'out', 'withdrawal', _amount, bal, after_v, 'Solicitação de saque via PIX', wid, 'pending');

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Saque solicitado', 'Sua solicitação de saque de R$ ' || _amount || ' foi registrada.', 'withdrawal');
  RETURN wid;
END; $$;
REVOKE ALL ON FUNCTION public.request_withdrawal(UUID, public.wallet_type, NUMERIC, public.pix_key_type, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_withdrawal(_admin UUID, _wid UUID, _action TEXT, _reason TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w RECORD;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _wid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF w.status IN ('paid','rejected','cancelled') THEN RAISE EXCEPTION 'Saque já finalizado'; END IF;

  IF _action = 'approve' THEN
    UPDATE public.withdrawals SET status='processing' WHERE id=_wid;
  ELSIF _action = 'pay' THEN
    UPDATE public.withdrawals SET status='paid', processed_at=now() WHERE id=_wid;
    UPDATE public.wallet_transactions SET status='completed' WHERE reference_id=_wid AND category='withdrawal';
    INSERT INTO public.notifications (user_id, title, body, type) VALUES (w.user_id,'Saque pago','Seu saque de R$ ' || w.net_amount || ' foi pago.','withdrawal');
  ELSIF _action = 'reject' THEN
    UPDATE public.withdrawals SET status='rejected', reject_reason=_reason, processed_at=now() WHERE id=_wid;
    UPDATE public.wallet_transactions SET status='cancelled' WHERE reference_id=_wid AND category='withdrawal';
    PERFORM public.credit_wallet(w.user_id, w.wallet_type, w.amount, 'withdrawal', 'Estorno de saque rejeitado', _wid);
    INSERT INTO public.notifications (user_id, title, body, type) VALUES (w.user_id,'Saque rejeitado', COALESCE(_reason,'Sua solicitação foi rejeitada.'),'withdrawal');
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, table_name, record_id, old_value, new_value)
  VALUES (_admin, 'withdrawal_' || _action, 'withdrawals', _wid, jsonb_build_object('status', w.status), jsonb_build_object('reason', _reason));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.process_withdrawal(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ===== resgate de produto =====
CREATE OR REPLACE FUNCTION public.redeem_product(_user UUID, _product UUID, _addr JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr RECORD; bal BIGINT; oid UUID;
BEGIN
  SELECT * INTO pr FROM public.products WHERE id=_product AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  IF pr.stock < 1 THEN RAISE EXCEPTION 'Produto sem estoque'; END IF;

  SELECT points_balance INTO bal FROM public.wallets WHERE user_id=_user FOR UPDATE;
  IF bal IS NULL OR bal < pr.points_cost THEN RAISE EXCEPTION 'Pontos insuficientes'; END IF;

  UPDATE public.products SET stock = stock - 1 WHERE id = pr.id;

  INSERT INTO public.orders (user_id, points_used, ship_name, ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state)
  VALUES (_user, pr.points_cost,
    _addr->>'name', _addr->>'zip', _addr->>'street', _addr->>'number', _addr->>'complement', _addr->>'district', _addr->>'city', _addr->>'state')
  RETURNING id INTO oid;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, points_cost)
  VALUES (oid, pr.id, pr.name, 1, pr.points_cost);

  PERFORM public.credit_points(_user, -pr.points_cost, 'redeem', 'Resgate: ' || pr.name, oid);

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user, 'Resgate confirmado', 'Seu pedido de ' || pr.name || ' foi criado.', 'order');
  RETURN oid;
END; $$;
REVOKE ALL ON FUNCTION public.redeem_product(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ===== dados iniciais =====
INSERT INTO public.settings (key, value, is_public) VALUES
  ('platform_name','"Nexora"',true),
  ('logo_url','null',true),
  ('support_email','"suporte@nexora.app"',true),
  ('support_whatsapp','"5511999999999"',true),
  ('support_link','""',true),
  ('withdraw_min','20',true),
  ('withdraw_max','5000',true),
  ('withdraw_fee_percent','2',true),
  ('withdraw_deadline_text','"Até 2 dias úteis"',true),
  ('referral_rates','{"1":10,"2":5,"3":2}',true),
  ('pix_gateway','"internal"',false),
  ('pix_expiration_minutes','30',true),
  ('maintenance_message','""',true),
  ('terms','"Estes são os Termos de Uso da plataforma. O administrador pode editar este texto no painel administrativo."',true),
  ('privacy','"Esta é a Política de Privacidade da plataforma. O administrador pode editar este texto no painel administrativo."',true),
  ('cookies','"Esta é a Política de Cookies da plataforma. O administrador pode editar este texto no painel administrativo."',true);

INSERT INTO public.plans (name, description, price, points, benefits, validity_days, sort_order) VALUES
  ('Iniciante','Ideal para começar na plataforma.',10.00,150,ARRAY['Pontos para troca no catálogo','Participação em campanhas','Liberação após confirmação do pagamento'],30,1),
  ('Essencial','Mais pontos e benefícios ampliados.',30.00,450,ARRAY['Pontos para troca no catálogo','Participação em campanhas','Suporte prioritário'],60,2),
  ('Avançado','Para quem quer aproveitar ao máximo.',100.00,1800,ARRAY['Pontos para troca no catálogo','Participação em campanhas','Suporte prioritário','Validade estendida'],90,3);

INSERT INTO public.product_categories (name) VALUES ('Acessórios'),('Suplementos'),('Vestuário');

INSERT INTO public.products (name, description, points_cost, stock, sku, category_id) VALUES
  ('Coqueteleira 700ml','Coqueteleira livre de BPA com misturador.',8550,25,'ACC-001',(SELECT id FROM public.product_categories WHERE name='Acessórios')),
  ('Creatina Monohidratada 300g','Suplemento em pó, pote de 300g.',12350,10,'SUP-001',(SELECT id FROM public.product_categories WHERE name='Suplementos')),
  ('Whey Protein 900g','Proteína concentrada, sabor baunilha.',18900,8,'SUP-002',(SELECT id FROM public.product_categories WHERE name='Suplementos')),
  ('Camiseta Dry Fit','Tecido leve e respirável.',6200,40,'VES-001',(SELECT id FROM public.product_categories WHERE name='Vestuário')),
  ('Garrafa Térmica 1L','Aço inox, mantém a temperatura por 12h.',9400,15,'ACC-002',(SELECT id FROM public.product_categories WHERE name='Acessórios')),
  ('Boné Esportivo','Ajustável, com proteção UV.',4300,50,'VES-002',(SELECT id FROM public.product_categories WHERE name='Vestuário'));

INSERT INTO public.banners (title, subtitle, button_label, button_url, sort_order) VALUES
  ('Ative seu primeiro plano','Escolha um plano e comece a acumular pontos hoje mesmo.','Ver planos','/planos',1),
  ('Indique e acompanhe','Compartilhe seu link e acompanhe suas indicações em tempo real.','Minhas indicações','/indicacoes',2);
