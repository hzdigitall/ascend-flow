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

export const maskPhone = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");

export const maskCEP = (v: string) =>
  onlyDigits(v)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
