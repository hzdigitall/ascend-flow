import { z } from "zod";
import { onlyDigits } from "./format";

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

export const cpfSchema = z
  .string()
  .refine((v) => isValidCPF(v), { message: "CPF inválido" });

export const phoneSchema = z
  .string()
  .refine((v) => {
    const digits = onlyDigits(v);
    // BR: 10-11 dígitos (DDD + número), com ou sem prefixo 55
    const local = digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")
      ? digits.slice(2)
      : digits;
    if (local.length >= 10 && local.length <= 11) return true;
    // Internacional: 8 a 15 dígitos (E.164)
    return digits.length >= 8 && digits.length <= 15;
  }, { message: "Telefone inválido" });

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter ao menos 8 caracteres")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
  .regex(/[0-9]/, "Inclua ao menos um número");

const signUpBase = {
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  referralCode: z.string().trim().max(16).optional().or(z.literal("")),
  terms: z.literal(true, { message: "É necessário aceitar os termos" }),
};

const matchPasswords = {
  message: "As senhas não coincidem",
  path: ["confirmPassword"] as (string | number)[],
};


export const signUpSchema = z
  .object({ ...signUpBase, cpf: cpfSchema })
  .refine((d) => d.password === d.confirmPassword, matchPasswords);

/** CPF é exigido apenas em português; em inglês o campo não é exibido nem validado. */
export function makeSignUpSchema(requireCpf: boolean) {
  return requireCpf
    ? signUpSchema
    : z
        .object({ ...signUpBase, cpf: z.string().optional().or(z.literal("")) })
        .refine((d) => d.password === d.confirmPassword, matchPasswords);
}


export const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const addressSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome").max(120),
  zip: z.string().trim().min(8, "CEP inválido").max(9),
  street: z.string().trim().min(3, "Informe a rua").max(160),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().min(2, "Informe o bairro").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF com 2 letras"),
});

export type AddressInput = z.infer<typeof addressSchema>;
