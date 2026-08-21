-- Adicionando pontos para o usuário de teste com cast explícito para tx_direction
DO $$
BEGIN
  PERFORM public.credit_points('d5dd072b-bd9c-42f6-a4d4-dda861cf328f'::uuid, 5000::bigint, 'adjustment', 'Crédito de teste para validação da loja', NULL);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback caso a função precise de ajuste, faremos manualmente
    UPDATE public.wallets SET points_balance = points_balance + 5000 WHERE user_id = 'd5dd072b-bd9c-42f6-a4d4-dda861cf328f'::uuid;
    INSERT INTO public.points_transactions (user_id, direction, points, balance_after, category, description)
    SELECT 'd5dd072b-bd9c-42f6-a4d4-dda861cf328f'::uuid, 'in'::public.tx_direction, 5000, points_balance, 'adjustment', 'Crédito de teste manual'
    FROM public.wallets WHERE user_id = 'd5dd072b-bd9c-42f6-a4d4-dda861cf328f'::uuid;
END $$;