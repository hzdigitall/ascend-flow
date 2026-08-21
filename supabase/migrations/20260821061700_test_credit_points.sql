-- Adicionando pontos para o usuário d5dd072b-bd9c-42f6-a4d4-dda861cf328f
DO $$
BEGIN
  PERFORM public.credit_points('d5dd072b-bd9c-42f6-a4d4-dda861cf328f'::uuid, 5000::bigint, 'adjustment', 'Crédito de teste', NULL);
END $$;
