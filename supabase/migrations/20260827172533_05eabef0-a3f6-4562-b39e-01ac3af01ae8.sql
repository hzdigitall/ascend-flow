CREATE TABLE public.plan_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_plan_id uuid REFERENCES public.user_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT '',
  event text NOT NULL,
  old_status text,
  new_status text,
  earned_total numeric NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_audit_logs TO authenticated;
GRANT ALL ON public.plan_audit_logs TO service_role;

ALTER TABLE public.plan_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê sua própria auditoria de planos"
  ON public.plan_audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE INDEX idx_plan_audit_logs_user ON public.plan_audit_logs (user_id, created_at DESC);
CREATE INDEX idx_plan_audit_logs_plan ON public.plan_audit_logs (user_plan_id);

CREATE OR REPLACE FUNCTION public.log_user_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE total NUMERIC;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(SUM(amount),0) INTO total
      FROM public.wallet_transactions
     WHERE reference_id = NEW.id AND category = 'earning'::tx_category;

    INSERT INTO public.plan_audit_logs
      (user_plan_id, user_id, plan_name, event, old_status, new_status, earned_total, details)
    VALUES (NEW.id, NEW.user_id, NEW.plan_name,
            CASE NEW.status::text
              WHEN 'active' THEN 'plan_activated'
              WHEN 'expired' THEN 'plan_expired'
              WHEN 'cancelled' THEN 'plan_cancelled'
              ELSE 'plan_status_changed' END,
            OLD.status::text, NEW.status::text, total,
            jsonb_build_object('price', NEW.price, 'expires_at', NEW.expires_at));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_user_plans_audit
AFTER UPDATE ON public.user_plans
FOR EACH ROW EXECUTE FUNCTION public.log_user_plan_change();

CREATE OR REPLACE FUNCTION public.expire_due_plans(_user uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (r.user_id, 'Plano expirado',
            'Seu plano ' || r.plan_name || ' venceu e não gera mais rendimentos.', 'plan');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_expiring_plans(_days integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT up.* FROM public.user_plans up
     WHERE up.status = 'active'::user_plan_status
       AND up.expires_at IS NOT NULL
       AND up.expires_at > now()
       AND up.expires_at <= now() + (_days || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM public.plan_audit_logs l
          WHERE l.user_plan_id = up.id AND l.event = 'plan_expiring_notified')
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (r.user_id, 'Seu plano está próximo do vencimento',
            'O plano ' || r.plan_name || ' vence em ' ||
            to_char(r.expires_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.', 'plan');

    INSERT INTO public.plan_audit_logs
      (user_plan_id, user_id, plan_name, event, old_status, new_status, details)
    VALUES (r.id, r.user_id, r.plan_name, 'plan_expiring_notified', 'active', 'active',
            jsonb_build_object('expires_at', r.expires_at, 'days', _days));
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.has_active_plan(_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE ok BOOLEAN;
BEGIN
  PERFORM public.expire_due_plans(_user);
  SELECT EXISTS (
    SELECT 1 FROM public.user_plans
     WHERE user_id = _user AND status = 'active'::user_plan_status
       AND (expires_at IS NULL OR expires_at > now())
  ) INTO ok;
  RETURN ok;
END; $$;

REVOKE EXECUTE ON FUNCTION public.expire_due_plans(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_expiring_plans(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_plan(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.process_daily_roi()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; roi_pct NUMERIC; roi_amt NUMERIC; max_amt NUMERIC; current_total NUMERIC; last_at TIMESTAMPTZ; dow INT; finished BOOLEAN;
BEGIN
  PERFORM public.expire_due_plans(NULL);
  PERFORM public.notify_expiring_plans(3);

  dow := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Sao_Paulo'));
  IF dow > 5 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT up.*, p.price AS plan_price, p.name AS plan_name
    FROM public.user_plans up
    JOIN public.plans p ON p.id = up.plan_id
    WHERE up.status = 'active'
      AND up.activated_at IS NOT NULL
      AND up.activated_at <= now() - interval '24 hours'
  LOOP
    SELECT max(created_at) INTO last_at FROM public.daily_roi_logs WHERE user_plan_id = r.id;
    IF last_at IS NOT NULL AND last_at > now() - interval '20 hours' THEN
      CONTINUE;
    END IF;

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
      max_amt := round(r.plan_price, 2);
      finished := false;

      SELECT COALESCE(SUM(amount), 0) INTO current_total
      FROM public.wallet_transactions
      WHERE user_id = r.user_id AND reference_id = r.id AND category = 'earning';

      IF (current_total + roi_amt) >= max_amt THEN
        roi_amt := round(max_amt - current_total, 2);
        finished := true;
        UPDATE public.user_plans SET status = 'expired', updated_at = now() WHERE id = r.id;
      END IF;

      IF roi_amt > 0 THEN
        PERFORM public.credit_wallet(r.user_id, roi_amt, 'earnings', 'earning', 'Rendimento diário: ' || r.plan_name, r.id);
        INSERT INTO public.daily_roi_logs (user_plan_id, amount) VALUES (r.id, roi_amt);

        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (r.user_id, 'Rendimento diário creditado',
                'Seu plano ' || r.plan_name || ' rendeu R$ ' || trim(to_char(roi_amt,'FM999999990.00')) || ' hoje.',
                'earning');
      END IF;

      IF finished THEN
        INSERT INTO public.plan_audit_logs
          (user_plan_id, user_id, plan_name, event, old_status, new_status, earned_total, details)
        VALUES (r.id, r.user_id, r.plan_name, 'plan_cycle_completed', 'active', 'expired',
                current_total + COALESCE(roi_amt,0), jsonb_build_object('cap', max_amt));

        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (r.user_id, 'Ciclo do plano concluído',
                'Seu plano ' || r.plan_name || ' concluiu o ciclo de rendimentos.',
                'earning');
      END IF;
    END IF;
  END LOOP;
END;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_plans;
ALTER TABLE public.user_plans REPLICA IDENTITY FULL;