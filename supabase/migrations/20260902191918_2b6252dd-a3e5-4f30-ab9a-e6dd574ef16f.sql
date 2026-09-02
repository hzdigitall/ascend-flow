DO $$
DECLARE r record;
BEGIN
  UPDATE public.profiles
     SET sponsor_id = '1b100c61-41a1-47c3-9cda-081f39647672'
   WHERE id = 'bd95539d-f097-49be-b215-af420f66f791';

  FOR r IN
    WITH RECURSIVE tree AS (
      SELECT id, 1 AS depth FROM public.profiles WHERE sponsor_id = 'bd95539d-f097-49be-b215-af420f66f791'
      UNION ALL
      SELECT p.id, t.depth + 1 FROM public.profiles p JOIN tree t ON p.sponsor_id = t.id WHERE t.depth < 12
    )
    SELECT id FROM tree ORDER BY depth
  LOOP
    UPDATE public.profiles SET sponsor_id = sponsor_id WHERE id = r.id;
  END LOOP;
END $$;