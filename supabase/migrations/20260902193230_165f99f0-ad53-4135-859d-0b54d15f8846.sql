CREATE OR REPLACE FUNCTION public.guard_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status::text,'') <> 'paid' THEN
    IF NEW.gateway IN ('balance','admin') THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.deposits d
               WHERE d.payment_id = NEW.id AND d.status IN ('credited','finished','confirmed')) THEN
      RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_events e
               WHERE e.payment_id = NEW.id AND e.event_type LIKE 'webhook:%') THEN
      RETURN NEW;
    END IF;
    IF NEW.external_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.payment_webhook_events w
      WHERE w.external_id = NEW.external_id AND COALESCE(w.signature_valid, true)
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Pagamento sem comprovação de recebimento não pode ser confirmado';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_payment_paid() FROM PUBLIC, anon, authenticated;