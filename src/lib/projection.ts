/**
 * Tabela de projeção Arena — organiza os planos por faixa de investimento,
 * porcentagem diária, dias úteis até dobrar e montante final (200% do aporte).
 */

export type PlanTierName =
  | "Iniciante"
  | "Intermediário"
  | "Avançado"
  | "Profissional"
  | "Elite";

export type PlanTier = {
  name: PlanTierName;
  /** Porcentagem creditada por dia útil */
  dailyPct: number;
  /** Dias úteis necessários para dobrar o investimento */
  daysToDouble: number;
  /** Menor aporte da faixa */
  min: number;
  /** Maior aporte da faixa */
  max: number;
  /** Valores de aporte apresentados na tabela de projeção */
  amounts: number[];
};

export const PLAN_TIERS: PlanTier[] = [
  {
    name: "Iniciante",
    dailyPct: 3.5,
    daysToDouble: 29,
    min: 50,
    max: 150,
    amounts: [50, 100, 150],
  },
  {
    name: "Intermediário",
    dailyPct: 4.5,
    daysToDouble: 23,
    min: 200,
    max: 450,
    amounts: [200, 250, 300, 350, 400, 450],
  },
  {
    name: "Avançado",
    dailyPct: 5.5,
    daysToDouble: 19,
    min: 500,
    max: 950,
    amounts: [500, 550, 600, 650, 700, 750, 800, 850, 900, 950],
  },
  {
    name: "Profissional",
    dailyPct: 6.5,
    daysToDouble: 16,
    min: 1000,
    max: 2500,
    amounts: [1000, 1500, 2000, 2500],
  },
  {
    name: "Elite",
    dailyPct: 7.5,
    daysToDouble: 14,
    min: 3000,
    max: 5000,
    amounts: [3000, 3500, 4000, 4500, 5000],
  },
];

/** Faixa correspondente a um valor investido */
export function tierForAmount(amount: number): PlanTier | undefined {
  return PLAN_TIERS.find((t) => amount >= t.min && amount <= t.max);
}

/** Faixa correspondente ao nome do plano */
export function tierForPlan(name: string): PlanTier | undefined {
  return PLAN_TIERS.find((t) => t.name === name);
}

/** Rendimento diário em reais */
export function dailyEarning(amount: number, dailyPct: number): number {
  return (amount * dailyPct) / 100;
}

/** Montante final: todos os planos rendem até dobrar (200%) */
export function finalAmount(amount: number): number {
  return amount * 2;
}

export type ProjectionRow = {
  amount: number;
  dailyPct: number;
  dailyValue: number;
  days: number;
  total: number;
};

/** Linhas de projeção de uma faixa */
export function projectionRows(tier: PlanTier): ProjectionRow[] {
  return tier.amounts.map((amount) => ({
    amount,
    dailyPct: tier.dailyPct,
    dailyValue: dailyEarning(amount, tier.dailyPct),
    days: tier.daysToDouble,
    total: finalAmount(amount),
  }));
}

/** Todas as linhas da tabela, em ordem crescente de aporte */
export function allProjectionRows(): ProjectionRow[] {
  return PLAN_TIERS.flatMap(projectionRows);
}
