/**
 * Conversão interna USDT <-> BRL.
 *
 * O saldo do sistema é sempre contabilizado em BRL. Toda operação em USDT
 * utiliza uma cotação interna fixa (configurável pelo administrador) e a taxa
 * usada é congelada na própria transação.
 *
 * Este módulo é seguro para o cliente e serve apenas para SIMULAÇÃO na tela.
 * O valor financeiro definitivo é sempre recalculado no backend.
 */
export const DEFAULT_USDT_BRL_RATE = 5;
export const USDT_RATE_SETTING_KEY = "usdt_brl_rate";
export const USDT_NETWORK = "BEP20";
export const USDT_NETWORK_LABEL = "BEP20 / BNB Smart Chain";

/** Normaliza a cotação lida das configurações. */
export function normalizeRate(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USDT_BRL_RATE;
}

/** BRL -> USDT (6 casas, precisão suportada pela gateway). */
export function brlToUsdt(amountBrl: number, rate: number): number {
  const r = normalizeRate(rate);
  return Math.round((amountBrl / r) * 1_000_000) / 1_000_000;
}

/** USDT -> BRL (centavos). */
export function usdtToBrl(amountUsdt: number, rate: number): number {
  const r = normalizeRate(rate);
  return Math.round(amountUsdt * r * 100) / 100;
}

export function fmtUsdt(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT`;
}

export function fmtRate(rate: number): string {
  return `1 USDT = ${normalizeRate(rate).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}`;
}
