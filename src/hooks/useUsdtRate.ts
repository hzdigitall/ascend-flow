import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_USDT_BRL_RATE, USDT_RATE_SETTING_KEY, normalizeRate } from "@/lib/usdt";

/** Cotação interna vigente (apenas para simulação na interface). */
export function useUsdtRate(): number {
  const { get } = useSettings();
  return normalizeRate(get<number>(USDT_RATE_SETTING_KEY, DEFAULT_USDT_BRL_RATE));
}
