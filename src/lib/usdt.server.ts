/**
 * Cotação interna USDT (server-only).
 *
 * A taxa vigente vive na tabela `settings` (chave `usdt_brl_rate`) e é lida
 * SEMPRE no backend. Nenhum valor de conversão enviado pelo navegador é
 * considerado.
 */
import { DEFAULT_USDT_BRL_RATE, normalizeRate } from "./usdt";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function currentUsdtRate(admin: AdminClient): Promise<number> {
  const { data } = await admin.rpc("usdt_brl_rate");
  return normalizeRate(data ?? DEFAULT_USDT_BRL_RATE);
}

/** BRL -> USDT com 6 casas decimais (precisão aceita pela NOWPayments). */
export function toUsdt(amountBrl: number, rate: number): number {
  return Math.round((amountBrl / normalizeRate(rate)) * 1_000_000) / 1_000_000;
}

/** USDT -> BRL em centavos. */
export function toBrl(amountUsdt: number, rate: number): number {
  return Math.round(amountUsdt * normalizeRate(rate) * 100) / 100;
}
