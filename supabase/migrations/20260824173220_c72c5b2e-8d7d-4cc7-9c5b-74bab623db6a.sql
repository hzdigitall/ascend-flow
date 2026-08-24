ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS purchase_blocked BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.create_plan_payment(_user UUID, _plan UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD; up UUID; pay UUID; mins INT;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível'; END IF;
  IF p.purchase_blocked THEN RAISE EXCEPTION 'Indisponível para aquisição no momento'; END IF;
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