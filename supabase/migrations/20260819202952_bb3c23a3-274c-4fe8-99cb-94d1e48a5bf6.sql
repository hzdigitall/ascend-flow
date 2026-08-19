
-- 1. Habilitar RLS e conceder permissões para a tabela de logs de ROI
ALTER TABLE public.daily_roi_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.daily_roi_logs TO authenticated;
GRANT ALL ON public.daily_roi_logs TO service_role;

-- Política para que usuários vejam apenas logs de seus próprios planos
CREATE POLICY "roi_logs_self_read" ON public.daily_roi_logs 
FOR SELECT TO authenticated 
USING (
    user_plan_id IN (SELECT id FROM public.user_plans WHERE user_id = auth.uid()) 
    OR public.is_admin()
);

-- 2. Restringir execução de funções SECURITY DEFINER (Segurança)
REVOKE ALL ON FUNCTION public.process_daily_roi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_roi() TO service_role;

REVOKE ALL ON FUNCTION public.confirm_payment(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, JSONB) TO service_role;

-- 3. Corrigir permissões da função de busca de configuração
REVOKE ALL ON FUNCTION public.get_setting(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting(TEXT, JSONB) TO service_role;
