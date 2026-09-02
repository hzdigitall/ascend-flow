CREATE OR REPLACE FUNCTION public.push_login_notices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = uid AND type = 'network_care' AND created_at > now() - interval '6 hours'
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      uid,
      'network_care',
      'Cuide bem da sua rede',
      'Verifique com atenção quem você indica e para quem envia seu link de cadastro. Acompanhe seus indicados, oriente sua equipe e gerencie bem a sua rede — o crescimento sustentável começa com boas indicações.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = uid AND type = 'bla_announce' AND created_at > now() - interval '6 hours'
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      uid,
      'bla_announce',
      'BLA — Bônus de Liderança Ativa em breve',
      'Só aqui na Arena o líder é reconhecido pelo seu trabalho. O Bônus de Liderança Ativa está chegando: acumule pontos todo mês com a sua rede e receba o bônus da sua graduação.'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.push_login_notices() FROM anon;
GRANT EXECUTE ON FUNCTION public.push_login_notices() TO authenticated;