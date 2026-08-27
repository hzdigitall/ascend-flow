CREATE TABLE public.whatsapp_settings (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  notify_deposit boolean NOT NULL DEFAULT true,
  notify_withdrawal boolean NOT NULL DEFAULT true,
  notify_referral boolean NOT NULL DEFAULT true,
  notify_commission boolean NOT NULL DEFAULT true,
  token_ciphertext text,
  token_iv text,
  token_last_four text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_settings_singleton CHECK (id)
);

GRANT ALL ON public.whatsapp_settings TO service_role;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_settings (id) VALUES (true);