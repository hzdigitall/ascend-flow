DO $$
DECLARE _plan uuid; _admin uuid; _user uuid;
BEGIN
  SELECT id INTO _plan FROM public.plans WHERE name = 'Iniciante 10';
  IF _plan IS NULL THEN
    INSERT INTO public.plans (name, description, price, points, benefits, validity_days, sort_order, active, purchase_blocked)
    VALUES ('Iniciante 10', 'Plano de R$ 10 para liberação manual.', 10.00, 0, ARRAY['Rendimento diário conforme regras da faixa Iniciante'], 45, 0, false, true)
    RETURNING id INTO _plan;
  END IF;

  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id INTO _user FROM public.profiles WHERE email = 'gabrieldafontouracr@gmail.com';

  PERFORM public.admin_grant_plan(_admin, _user, _plan, 'Montante manual de R$ 10');
END $$;