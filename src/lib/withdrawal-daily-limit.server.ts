import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Limite de 1 saque por dia por usuário (dia civil no horário de Brasília).
 * Saques rejeitados/cancelados não contam.
 */
export async function assertDailyWithdrawalLimit(
  admin: SupabaseClient<any, any, any>,
  userId: string,
): Promise<void> {
  const nowBr = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const startBr = new Date(nowBr.getFullYear(), nowBr.getMonth(), nowBr.getDate(), 0, 0, 0, 0);
  // Brasília = UTC-3
  const startUtc = new Date(startBr.getTime() + 3 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const { count, error } = await admin
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtc.toISOString())
    .not("status", "in", "(rejected,cancelled)");

  if (error) throw new Error(error.message);
  if ((count ?? 0) >= 1) {
    throw new Error("Você já solicitou um saque hoje. É permitido apenas 1 saque por dia.");
  }
}
