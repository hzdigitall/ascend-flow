CREATE INDEX IF NOT EXISTS idx_user_plans_user_status ON public.user_plans (user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_sponsor_level ON public.referrals (sponsor_id, level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptx_user_dir_created ON public.points_transactions (user_id, direction, created_at DESC);