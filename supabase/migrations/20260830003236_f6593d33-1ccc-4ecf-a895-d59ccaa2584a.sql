CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_digits_unique
  ON public.profiles ((regexp_replace(cpf,'\D','','g')))
  WHERE cpf IS NOT NULL AND cpf <> '';

CREATE OR REPLACE FUNCTION public.cpf_available(_cpf text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cpf IS NOT NULL AND cpf <> ''
      AND regexp_replace(cpf,'\D','','g') = regexp_replace(COALESCE(_cpf,''),'\D','','g')
  ) AND length(regexp_replace(COALESCE(_cpf,''),'\D','','g')) = 11;
$$;

REVOKE ALL ON FUNCTION public.cpf_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cpf_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sponsor UUID;
  v_ref TEXT;
  v_cpf TEXT;
  v_cur UUID;
  v_lvl INT;
  v_bonus NUMERIC;
BEGIN
  BEGIN
    v_ref := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');
    IF v_ref IS NOT NULL THEN
      SELECT id INTO v_sponsor FROM public.profiles WHERE referral_code = upper(v_ref);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_sponsor := NULL;
  END;

  v_cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf',''),'\D','','g'), '');

  IF v_cpf IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cpf IS NOT NULL AND cpf <> ''
      AND regexp_replace(cpf,'\D','','g') = v_cpf
  ) THEN
    RAISE EXCEPTION 'CPF_JA_CADASTRADO' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, cpf, referral_code, sponsor_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone',
    v_cpf,
    public.generate_referral_code(),
    v_sponsor
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  BEGIN
    IF v_sponsor IS NOT NULL THEN
      v_cur := v_sponsor;
      v_lvl := 1;
      WHILE v_cur IS NOT NULL AND v_lvl <= 8 LOOP
        INSERT INTO public.referrals (sponsor_id, referred_id, level)
        VALUES (v_cur, NEW.id, v_lvl) ON CONFLICT DO NOTHING;
        SELECT sponsor_id INTO v_cur FROM public.profiles WHERE id = v_cur;
        v_lvl := v_lvl + 1;
      END LOOP;

      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (v_sponsor, 'Nova indicação', COALESCE(NEW.raw_user_meta_data->>'full_name','Um novo usuário') || ' se cadastrou pelo seu link.', 'referral');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user referrals falhou para %: %', NEW.id, SQLERRM;
  END;

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
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;