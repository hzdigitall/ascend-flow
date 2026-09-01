
CREATE POLICY "notif_self_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT ur.user_id, 'new_user', 'Novo cadastro na plataforma',
           COALESCE(NEW.full_name, 'Novo usuário') || ' (' || COALESCE(NEW.email, 'sem e-mail') || ') acabou de se registrar.'
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_user ON public.profiles;
CREATE TRIGGER trg_notify_admins_new_user
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_user();

REVOKE EXECUTE ON FUNCTION public.notify_admins_new_user() FROM PUBLIC, anon, authenticated;
