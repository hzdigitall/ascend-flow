CREATE TABLE public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_change_requests TO authenticated;
GRANT ALL ON public.email_change_requests TO service_role;

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_email_change_requests_select"
ON public.email_change_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE INDEX email_change_requests_user_idx ON public.email_change_requests (user_id, created_at DESC);

CREATE TRIGGER update_email_change_requests_updated_at
BEFORE UPDATE ON public.email_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();