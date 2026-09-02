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

/**
 * Normaliza a chave antes de enviar à gateway: CPF/CNPJ/telefone só com
 * dígitos (a ConnectPay recusa chaves com máscara — "Dados inválidos").
 */
export function normalizePixKey(type: string | null, key: string): string {
  const trimmed = key.trim();
  switch (type) {
    case "cpf":
    case "cnpj":
      return trimmed.replace(/\D/g, "");
    case "phone": {
      const digits = trimmed.replace(/\D/g, "");
      return trimmed.startsWith("+") ? `+${digits}` : digits;
    }
    case "email":
      return trimmed.toLowerCase();
    default:
      return trimmed;
  }
}