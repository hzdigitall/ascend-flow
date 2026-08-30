CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_level_unique
  ON public.referrals (referred_id, level);

CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS TABLE(sponsor_id uuid, sponsor_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c text;
  normalized text;
  matches integer;
BEGIN
  c := upper(trim(COALESCE(_code, '')));
  IF c = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, split_part(p.full_name, ' ', 1)
    FROM public.profiles p
    WHERE p.referral_code = c
    LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  IF c ~ '^[0-9]+$' THEN
    normalized := COALESCE(NULLIF(ltrim(c, '0'), ''), '0');

    SELECT count(*)
      INTO matches
    FROM public.profiles p
    WHERE p.referral_code ~ '^[0-9]+$'
      AND COALESCE(NULLIF(ltrim(p.referral_code, '0'), ''), '0') = normalized;

    IF matches = 1 THEN
      RETURN QUERY
        SELECT p.id, split_part(p.full_name, ' ', 1)
        FROM public.profiles p
        WHERE p.referral_code ~ '^[0-9]+$'
          AND COALESCE(NULLIF(ltrim(p.referral_code, '0'), ''), '0') = normalized
        LIMIT 1;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_profile_sponsor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sponsor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sponsor_id = NEW.id THEN
    RAISE EXCEPTION 'SPONSOR_SELF_REFERENCE' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors(id, path) AS (
      SELECT NEW.sponsor_id, ARRAY[NEW.sponsor_id]::uuid[]
      UNION ALL
      SELECT p.sponsor_id, a.path || p.sponsor_id
      FROM ancestors a
      JOIN public.profiles p ON p.id = a.id
      WHERE p.sponsor_id IS NOT NULL
        AND NOT (p.sponsor_id = ANY(a.path))
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'SPONSOR_CYCLE_DETECTED' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_profile_sponsor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_profile_sponsor_trigger ON public.profiles;
CREATE TRIGGER validate_profile_sponsor_trigger
BEFORE INSERT OR UPDATE OF sponsor_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_sponsor();

CREATE OR REPLACE FUNCTION public.sync_referral_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public.referral_tree', 0));

  WITH RECURSIVE descendants(id) AS (
    SELECT NEW.id
    UNION
    SELECT p.id
    FROM public.profiles p
    JOIN descendants d ON p.sponsor_id = d.id
  )
  DELETE FROM public.referrals r
  WHERE r.referred_id IN (SELECT id FROM descendants);

  WITH RECURSIVE descendants(id) AS (
    SELECT NEW.id
    UNION
    SELECT p.id
    FROM public.profiles p
    JOIN descendants d ON p.sponsor_id = d.id
  ), ancestry(referred_id, sponsor_id, level, path) AS (
    SELECT d.id, p.sponsor_id, 1, ARRAY[d.id, p.sponsor_id]::uuid[]
    FROM descendants d
    JOIN public.profiles p ON p.id = d.id
    WHERE p.sponsor_id IS NOT NULL

    UNION ALL

    SELECT a.referred_id, p.sponsor_id, a.level + 1, a.path || p.sponsor_id
    FROM ancestry a
    JOIN public.profiles p ON p.id = a.sponsor_id
    WHERE a.level < 8
      AND p.sponsor_id IS NOT NULL
      AND NOT (p.sponsor_id = ANY(a.path))
  )
  INSERT INTO public.referrals (sponsor_id, referred_id, level, created_at)
  SELECT a.sponsor_id, a.referred_id, a.level, p.created_at
  FROM ancestry a
  JOIN public.profiles p ON p.id = a.referred_id
  ON CONFLICT (referred_id, level) DO UPDATE
    SET sponsor_id = EXCLUDED.sponsor_id,
        created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_tree() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_referral_tree_trigger ON public.profiles;
CREATE TRIGGER sync_referral_tree_trigger
AFTER INSERT OR UPDATE OF sponsor_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_referral_tree();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sponsor uuid;
  v_ref text;
  v_cpf text;
  v_bonus numeric;
BEGIN
  v_ref := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');
  IF v_ref IS NOT NULL THEN
    SELECT r.sponsor_id INTO v_sponsor
    FROM public.resolve_referral_code(v_ref) r;

    IF v_sponsor IS NULL THEN
      RAISE EXCEPTION 'REFERRAL_CODE_INVALID' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  v_cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');

  IF v_cpf IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cpf IS NOT NULL AND cpf <> ''
      AND regexp_replace(cpf, '\D', '', 'g') = v_cpf
  ) THEN
    RAISE EXCEPTION 'CPF_JA_CADASTRADO' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, cpf, referral_code, sponsor_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
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
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (
        v_sponsor,
        'Nova indicação',
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Um novo usuário') || ' se cadastrou pelo seu link.',
        'referral'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user notification failed for %: %', NEW.id, SQLERRM;
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
    RAISE WARNING 'handle_new_user bonus failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.get_my_network();
CREATE OR REPLACE FUNCTION public.get_my_network()
RETURNS TABLE(
  id uuid,
  level integer,
  created_at timestamptz,
  referred_id uuid,
  full_name text,
  email text,
  phone text,
  is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.level,
    p.created_at,
    r.referred_id,
    p.full_name,
    p.email,
    p.phone,
    EXISTS (
      SELECT 1
      FROM public.user_plans up
      WHERE up.user_id = r.referred_id
        AND up.status = 'active'
        AND (up.expires_at IS NULL OR up.expires_at > now())
    ) AS is_active
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.sponsor_id = auth.uid()
  ORDER BY r.level, p.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_network() TO authenticated;