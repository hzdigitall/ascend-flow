import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Montante da rede: soma dos planos ativos de todos os indicados (níveis 1..8)
 * e quanto essa rede já rendeu (rendimentos dos indicados + comissões do usuário).
 */
export const getNetworkAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("referred_id, level")
      .eq("sponsor_id", context.userId);

    const levelOf = new Map<string, number>();
    for (const r of refs ?? []) {
      const prev = levelOf.get(r.referred_id);
      if (prev == null || r.level < prev) levelOf.set(r.referred_id, r.level);
    }
    const ids = [...levelOf.keys()];

    const levels = new Map<
      number,
      { level: number; members: number; invested: number; earned: number }
    >();
    for (const lvl of levelOf.values()) {
      const row = levels.get(lvl) ?? { level: lvl, members: 0, invested: 0, earned: 0 };
      row.members += 1;
      levels.set(lvl, row);
    }

    if (ids.length > 0) {
      const { data: plans } = await supabaseAdmin
        .from("user_plans")
        .select("user_id, price")
        .in("user_id", ids)
        .eq("status", "active");
      for (const p of plans ?? []) {
        const lvl = levelOf.get(p.user_id);
        if (lvl == null) continue;
        const row = levels.get(lvl)!;
        row.invested += Number(p.price ?? 0);
      }

      const { data: earnings } = await supabaseAdmin
        .from("wallet_transactions")
        .select("user_id, amount")
        .in("user_id", ids)
        .eq("category", "earning");
      for (const e of earnings ?? []) {
        const lvl = levelOf.get(e.user_id);
        if (lvl == null) continue;
        const row = levels.get(lvl)!;
        row.earned += Number(e.amount ?? 0);
      }
    }

    const { data: commissions } = await supabaseAdmin
      .from("commissions")
      .select("amount")
      .eq("sponsor_id", context.userId);

    const byLevel = [...levels.values()].sort((a, b) => a.level - b.level);

    return {
      members: ids.length,
      totalInvested: byLevel.reduce((s, r) => s + r.invested, 0),
      totalEarned: byLevel.reduce((s, r) => s + r.earned, 0),
      myCommissions: (commissions ?? []).reduce((s, c) => s + Number(c.amount ?? 0), 0),
      byLevel,
    };
  });
