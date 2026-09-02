/**
 * Tipos de chave PIX aceitos e validação (cliente e servidor).
 */
export const PIX_TYPE_MAP = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "EMAIL",
  phone: "PHONE",
  random: "RANDOM",
} as const;

export function pixKeyIsValid(type: keyof typeof PIX_TYPE_MAP, key: string): boolean {
  const digits = key.replace(/\D/g, "");
  switch (type) {
    case "cpf":
      return digits.length === 11;
    case "cnpj":
      return digits.length === 14;
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(key);
    case "phone":
      return digits.length >= 10 && digits.length <= 13;
    case "random":
      return /^[0-9a-fA-F-]{32,36}$/.test(key.trim());
    default:
      return false;
  }
}