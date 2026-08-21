-- Ajustar a configuração de saques respeitando essas regras.
-- Taxa de saque 2%
UPDATE public.settings 
SET value = '2'::jsonb
WHERE key = 'withdraw_fee_percent';

-- Garantir que a lógica de saque no banco de dados respeite o saldo e a taxa.
-- (A função request_withdrawal no DB já aplica a taxa se configurada no settings).

-- A solicitação também pede explicitamente para ajustar a configuração.
