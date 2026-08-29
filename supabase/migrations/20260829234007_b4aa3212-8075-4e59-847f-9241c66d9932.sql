CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sponsor UUID;
  v_ref TEXT;
  lvl1 UUID; lvl2 UUID; lvl3 UUID;
  v_bonus NUMERIC;
BEGIN
  -- 1) Núcleo: perfil + carteira + role (nunca pode falhar silenciosamente)
  BEGIN
    v_ref := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');
    IF v_ref IS NOT NULL THEN
      SELECT id INTO v_sponsor FROM public.profiles WHERE referral_code = upper(v_ref);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_sponsor := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, email, phone, cpf, referral_code, sponsor_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    public.generate_referral_code(),
    v_sponsor
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  -- 2) Rede de indicação (não bloqueia o cadastro)
  BEGIN
    IF v_sponsor IS NOT NULL THEN
      lvl1 := v_sponsor;
      INSERT INTO public.referrals (sponsor_id, referred_id, level) VALUES (lvl1, NEW.id, 1) ON CONFLICT DO NOTHING;
      SELECT sponsor_id INTO lvl2 FROM public.profiles WHERE id = lvl1;
      IF lvl2 IS NOT NULL THEN
        INSERT INTO public.referrals (sponsor_id, referred_id, level) VALUES (lvl2, NEW.id, 2) ON CONFLICT DO NOTHING;
        SELECT sponsor_id INTO lvl3 FROM public.profiles WHERE id = lvl2;
        IF lvl3 IS NOT NULL THEN
          INSERT INTO public.referrals (sponsor_id, referred_id, level) VALUES (lvl3, NEW.id, 3) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (lvl1, 'Nova indicação', COALESCE(NEW.raw_user_meta_data->>'full_name','Um novo usuário') || ' se cadastrou pelo seu link.', 'referral');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user referrals falhou para %: %', NEW.id, SQLERRM;
  END;

  -- 3) Bônus de cadastro (não bloqueia o cadastro)
  BEGIN
    v_bonus := COALESCE((public.get_setting('signup_bonus', '30'::jsonb))::text::numeric, 30);
    IF v_bonus > 0 THEN
      PERFORM public.credit_wallet(NEW.id, v_bonus, 'main', 'bonus', 'Bônus de cadastro', NULL);
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (
        NEW.id,
        'Parabéns! Seu bônus de cadastro foi creditado',
        'Você recebeu R$ ' || to_char(v_bonus, 'FM999999990.00') || ' de bônus de cadastro no seu saldo principal.',
        'bonus'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user bonus falhou para %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$fn$;