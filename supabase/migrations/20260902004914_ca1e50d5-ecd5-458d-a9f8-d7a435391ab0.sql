REVOKE EXECUTE ON FUNCTION public.process_monthly_bla(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_career_points(uuid, bigint, date) FROM anon, authenticated;