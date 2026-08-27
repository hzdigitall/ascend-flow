import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Expira planos vencidos no banco, dispara os avisos de vencimento próximo e
 * devolve apenas os planos realmente válidos (com o total já rendido).
 */
export const getMyActivePlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncUserPlans, notifyExpiringForUser } = await import("./plans.server");

    const plans = await syncUserPlans(supabaseAdmin as any, context.userId);
    await notifyExpiringForUser(supabaseAdmin as any, context.userId, 3);

    const { data: txs } = await supabaseAdmin
      .from("wallet_transactions")
      .select("amount, reference_id, created_at")
      .eq("user_id", context.userId)
      .eq("category", "earning")
      .order("created_at", { ascending: false });

    const totals = new Map<string, { total: number; last: string }>();
    for (const tx of txs ?? []) {
      if (!tx.reference_id) continue;
      const prev = totals.get(tx.reference_id);
      totals.set(tx.reference_id, {
        total: (prev?.total ?? 0) + Number(tx.amount),
        last: prev?.last ?? tx.created_at,
      });
    }

    return plans.map((plan: any) => ({
      ...plan,
      earned_total: totals.get(plan.id)?.total ?? 0,
      last_earning_at: totals.get(plan.id)?.last ?? null,
    }));
  });

/** Verificação server-side de acesso a recursos liberados por plano. */
export const checkPlanAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncUserPlans } = await import("./plans.server");
    const plans = await syncUserPlans(supabaseAdmin as any, context.userId);
    return { allowed: plans.length > 0, activePlans: plans.length };
  });
