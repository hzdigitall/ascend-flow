import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Expira no banco todos os planos vencidos do usuário e devolve os planos
 * realmente válidos neste instante. Fonte da verdade para liberar recursos.
 */
export async function syncUserPlans(admin: SupabaseClient<any>, userId: string) {
  await admin.rpc("expire_due_plans", { _user: userId });

  const { data, error } = await admin
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).filter(
    (p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now,
  );
}

/** Lança erro quando o usuário não possui nenhum plano válido no banco. */
export async function assertActivePlan(admin: SupabaseClient<any>, userId: string) {
  const plans = await syncUserPlans(admin, userId);
  if (plans.length === 0) {
    throw new Error("Seu plano expirou. Adquira um plano ativo para usar este recurso.");
  }
  return plans;
}

/** Avisa (uma única vez por plano) que o vencimento está próximo. */
export async function notifyExpiringForUser(
  admin: SupabaseClient<any>,
  userId: string,
  days = 3,
) {
  const limit = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data: plans } = await admin
    .from("user_plans")
    .select("id, plan_name, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("expires_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .lte("expires_at", limit);

  for (const plan of plans ?? []) {
    const { data: already } = await admin
      .from("plan_audit_logs")
      .select("id")
      .eq("user_plan_id", plan.id)
      .eq("event", "plan_expiring_notified")
      .maybeSingle();
    if (already) continue;

    const when = new Date(plan.expires_at as string).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    await admin.from("notifications").insert({
      user_id: userId,
      title: "Seu plano está próximo do vencimento",
      body: `O plano ${plan.plan_name} vence em ${when}.`,
      type: "plan",
    });

    await admin.from("plan_audit_logs").insert({
      user_plan_id: plan.id,
      user_id: userId,
      plan_name: plan.plan_name,
      event: "plan_expiring_notified",
      old_status: "active",
      new_status: "active",
      details: { expires_at: plan.expires_at, days },
    });
  }
}
