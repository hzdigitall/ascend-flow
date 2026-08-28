INSERT INTO public.settings (key, value, is_public)
VALUES
  ('support_link', '"https://wa.me/message/VXPWMHULXYVYP1"', true),
  ('support_group', '"https://chat.whatsapp.com/KeE54gWRRr55oFDnMkiWGK?s=cl&p=a&ilr=0"', true)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      is_public = EXCLUDED.is_public,
      updated_at = now();