REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, cpf, avatar_url, notify_email, notify_whatsapp) ON public.profiles TO authenticated;