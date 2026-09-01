export const brl = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

export const pts = (value: number | string | null | undefined) =>
  `${new Intl.NumberFormat("pt-BR").format(Number(value ?? 0))} pts`;

export const dateBR = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";

export const dateTimeBR = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

export const initials = (name: string | null | undefined) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export const maskCPF = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

/** Remove o código do país (55) quando presente, mantendo DDD + número (10-11 dígitos). */
export const normalizeBRPhone = (v: string) => {
  let digits = onlyDigits(v);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
};

/**
 * Normaliza telefone para armazenamento, aceitando qualquer país (E.164).
 * Números BR (55 ou 10-11 dígitos) ficam no padrão local DDD+número;
 * internacionais são salvos com o prefixo "+" (ex.: +351912345678).
 */
export const normalizePhone = (v: string) => {
  const hasPlus = v.trim().startsWith("+");
  const digits = onlyDigits(v);
  if (!digits) return "";
  // BR sem prefixo (10-11 dígitos) ou com 55 → padrão local
  if (!hasPlus) {
    if (digits.length <= 11 || digits.startsWith("55")) return normalizeBRPhone(v);
  }
  if (hasPlus && digits.startsWith("55") && digits.length >= 12 && digits.length <= 13)
    return normalizeBRPhone(digits);
  return `+${digits.slice(0, 15)}`;
};

export const maskPhone = (v: string) => {
  const normalized = normalizePhone(v);
  if (normalized.startsWith("+")) return normalized;
  return normalized
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export const maskCEP = (v: string) =>
  onlyDigits(v)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
