/**
 * Serviço central NOWPayments (server-only) — EXCLUSIVAMENTE USDT BEP20.
 *
 * Nenhuma página/componente conversa diretamente com a NOWPayments: todas as
 * chamadas passam por aqui. API Key, IPN Secret, e-mail, senha e TOTP Secret
 * são carregados do cofre cifrado e nunca retornados, logados ou expostos.
 *
 * Documentação: https://documenter.getpostman.com/view/7907941/2s93JusNJt
 * Base:         https://api.nowpayments.io
 */
import { decryptSecret } from "./gateway-vault.server";

export const PROVIDER = "nowpayments" as const;
export const DEFAULT_BASE_URL = "https://api.nowpayments.io";

/** Ticker oficial: Tether USDT na BNB Smart Chain. Nunca usar USDT/TRC20/ERC20. */
export const PAY_CURRENCY = "usdtbsc" as const;
export const PAY_CURRENCY_LABEL = "USDTBSC" as const;
export const NETWORK = "BEP20" as const;
export const NETWORK_LABEL = "BEP20 — BNB Smart Chain" as const;

export type SecretKey = "api_key" | "ipn_secret" | "email" | "password" | "totp_secret";

export type NowGatewayRow = {
  provider: string;
  display_name: string;
  active: boolean;
  environment: string;
  base_url: string;
  webhook_base_url: string | null;
  credentials_configured: boolean;
  credential_last_four: string | null;
  connection_status: string;
  last_connection_test: string | null;
  last_error: string | null;
  usdt_deposit_enabled: boolean;
  usdt_withdraw_enabled: boolean;
  ipn_configured: boolean;
  payout_auth_configured: boolean;
  totp_configured: boolean;
  asset_available: boolean;
  balance_snapshot: Record<string, unknown>;
};

export class NowPaymentsError extends Error {
  status: number;
  detail: string | null;
  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.name = "NowPaymentsError";
    this.status = status;
    this.detail = detail;
  }
}

export function friendlyMessage(status: number): string {
  switch (status) {
    case 400:
      return "Dados inválidos para a operação na NOWPayments.";
    case 401:
      return "Falha de autenticação com a NOWPayments. Verifique a API Key.";
    case 403:
      return "Operação não autorizada pela NOWPayments (verifique whitelist de IP/carteira).";
    case 404:
      return "Registro não encontrado na NOWPayments.";
    case 409:
      return "Conflito informado pela NOWPayments para esta operação.";
    case 429:
      return "Muitas solicitações. Tente novamente em instantes.";
    case 503:
      return "Serviço da NOWPayments temporariamente indisponível.";
    default:
      return "Não foi possível processar sua solicitação neste momento.";
  }
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function loadGateway(admin: AdminClient): Promise<NowGatewayRow | null> {
  const { data } = await admin
    .from("payment_gateways")
    .select("*")
    .eq("provider", PROVIDER)
    .maybeSingle();
  return (data as unknown as NowGatewayRow | null) ?? null;
}

export function webhookBaseUrl(gateway: NowGatewayRow | null): string {
  const base =
    gateway?.webhook_base_url ||
    process.env["APP_URL"] ||
    "https://project--35b87076-8266-43d0-9bc0-100b94a9dab0.lovable.app";
  return base.replace(/\/+$/, "");
}

export const webhookUrls = (gateway: NowGatewayRow | null) => {
  const base = webhookBaseUrl(gateway);
  return {
    payment: `${base}/api/public/webhooks/nowpayments/payment`,
    payout: `${base}/api/public/webhooks/nowpayments/payout`,
  };
};

/** Carrega uma credencial decifrada do cofre. */
export async function loadSecretValue(
  admin: AdminClient,
  key: SecretKey,
): Promise<string | null> {
  const { data } = await admin
    .from("gateway_secrets")
    .select("ciphertext, iv")
    .eq("provider", PROVIDER)
    .eq("key_name", key)
    .maybeSingle();
  if (!data) return null;
  return decryptSecret(data.ciphertext, data.iv);
}

export async function requireApiKey(admin: AdminClient): Promise<string> {
  const key = await loadSecretValue(admin, "api_key");
  if (!key) throw new NowPaymentsError("API Key da NOWPayments não configurada.", 412);
  return key;
}

/** Garante gateway ativa + recurso habilitado; devolve o contexto de chamada. */
export async function requireActiveGateway(
  admin: AdminClient,
  feature: "usdt_deposit" | "usdt_withdraw",
): Promise<{ gateway: NowGatewayRow; apiKey: string }> {
  const gateway = await loadGateway(admin);
  const enabled =
    gateway &&
    gateway.active &&
    gateway.credentials_configured &&
    (feature === "usdt_deposit" ? gateway.usdt_deposit_enabled : gateway.usdt_withdraw_enabled);
  if (!gateway || !enabled) {
    throw new NowPaymentsError("Método de pagamento temporariamente indisponível.", 503);
  }
  const apiKey = await requireApiKey(admin);
  return { gateway, apiKey };
}

/* ------------------------------------------------------------------ */
/* Cliente HTTP                                                        */
/* ------------------------------------------------------------------ */

async function call<T>(options: {
  apiKey?: string | undefined;
  jwt?: string | undefined;
  baseUrl?: string | undefined;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.apiKey) headers["x-api-key"] = options.apiKey;
  if (options.jwt) headers["Authorization"] = `Bearer ${options.jwt}`;

  let response: Response;
  try {
    response = await fetch(`${base}${options.path}`, {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new NowPaymentsError("Não foi possível contatar a NOWPayments.", 503);
  }

  const raw = await response.text();
  if (!response.ok) {
    // Nunca logamos headers (onde vivem API Key/JWT), apenas rota + status.
    console.error(`[nowpayments] ${options.method} ${options.path} -> ${response.status}`);
    throw new NowPaymentsError(
      friendlyMessage(response.status),
      response.status,
      raw.slice(0, 800),
    );
  }
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new NowPaymentsError("Resposta inválida da NOWPayments.", 502);
  }
}

/* ------------------------------------------------------------------ */
/* Endpoints públicos / autenticados por API Key                        */
/* ------------------------------------------------------------------ */

/** GET /v1/status — apenas disponibilidade da API (não valida credencial). */
export function getApiStatus(baseUrl?: string) {
  return call<{ message?: string }>({ baseUrl, method: "GET", path: "/v1/status" });
}

/** GET /v1/merchant/coins — autenticado; usado para validar a API Key. */
export function getMerchantCoins(apiKey: string, baseUrl?: string) {
  return call<{ selectedCurrencies?: string[] }>({
    apiKey,
    baseUrl,
    method: "GET",
    path: "/v1/merchant/coins",
  });
}

/** GET /v1/balance */
export function getBalance(apiKey: string, baseUrl?: string) {
  return call<Record<string, { amount?: number; pendingAmount?: number } | unknown>>({
    apiKey,
    baseUrl,
    method: "GET",
    path: "/v1/balance",
  });
}

/** GET /v1/min-amount — mínimo oficial para o par informado. */
export function getMinAmount(
  apiKey: string,
  baseUrl: string | undefined,
  from: string,
  to: string,
) {
  return call<{ min_amount?: number; currency_from?: string; currency_to?: string }>({
    apiKey,
    baseUrl,
    method: "GET",
    path: `/v1/min-amount?currency_from=${encodeURIComponent(from)}&currency_to=${encodeURIComponent(to)}`,
  });
}

export type NowPayment = {
  payment_id?: string | number;
  payment_status?: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  actually_paid?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string | number;
  payin_extra_id?: string | null;
  network?: string | null;
  outcome_amount?: number;
  valid_until?: string | null;
  expiration_estimate_date?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

/** POST /v1/payment — cria a cobrança USDTBSC. */
export function createPayment(
  apiKey: string,
  baseUrl: string | undefined,
  body: {
    price_amount: number;
    price_currency: string;
    pay_currency: string;
    order_id: string;
    order_description: string;
    ipn_callback_url: string;
    is_fixed_rate?: boolean;
  },
) {
  return call<NowPayment>({ apiKey, baseUrl, method: "POST", path: "/v1/payment", body });
}

/** GET /v1/payment/:payment_id — apenas consulta/reconciliação. */
export function getPayment(apiKey: string, baseUrl: string | undefined, paymentId: string) {
  return call<NowPayment>({
    apiKey,
    baseUrl,
    method: "GET",
    path: `/v1/payment/${encodeURIComponent(paymentId)}`,
  });
}

/* ------------------------------------------------------------------ */
/* Payout (exige JWT)                                                  */
/* ------------------------------------------------------------------ */

/** POST /v1/auth — JWT de curta duração; nunca persistido. */
export async function getJwt(
  admin: AdminClient,
  baseUrl: string | undefined,
): Promise<string> {
  const email = await loadSecretValue(admin, "email");
  const password = await loadSecretValue(admin, "password");
  if (!email || !password) {
    throw new NowPaymentsError(
      "Falha de autenticação de payout NOWPayments: e-mail/senha não configurados.",
      412,
    );
  }
  const res = await call<{ token?: string }>({
    baseUrl,
    method: "POST",
    path: "/v1/auth",
    body: { email, password },
  });
  if (!res.token) {
    throw new NowPaymentsError("Falha de autenticação de payout NOWPayments.", 401);
  }
  return res.token;
}

/** POST /v1/payout/validate-address */
export function validateAddress(
  apiKey: string,
  baseUrl: string | undefined,
  address: string,
) {
  return call<Record<string, unknown>>({
    apiKey,
    baseUrl,
    method: "POST",
    path: "/v1/payout/validate-address",
    body: { address, currency: PAY_CURRENCY },
  });
}

export type NowPayoutBatch = {
  id?: string | number;
  withdrawals?: Array<{
    id?: string | number;
    batch_withdrawal_id?: string | number;
    status?: string;
    address?: string;
    currency?: string;
    amount?: string | number;
    hash?: string | null;
    error?: string | null;
    unique_external_id?: string | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/** POST /v1/payout — estrutura oficial de lote, mesmo para um único saque. */
export function createPayout(
  apiKey: string,
  jwt: string,
  baseUrl: string | undefined,
  body: {
    ipn_callback_url: string;
    withdrawals: Array<{
      address: string;
      currency: string;
      amount: number;
      ipn_callback_url: string;
      unique_external_id: string;
    }>;
  },
) {
  return call<NowPayoutBatch>({ apiKey, jwt, baseUrl, method: "POST", path: "/v1/payout", body });
}

/** POST /v1/payout/:batchId/verify */
export function verifyPayout(
  apiKey: string,
  jwt: string,
  baseUrl: string | undefined,
  batchId: string,
  verificationCode: string,
) {
  return call<Record<string, unknown>>({
    apiKey,
    jwt,
    baseUrl,
    method: "POST",
    path: `/v1/payout/${encodeURIComponent(batchId)}/verify`,
    body: { verification_code: verificationCode },
  });
}

/** GET /v1/payout/:payout_id — apenas consulta/reconciliação. */
export function getPayout(apiKey: string, baseUrl: string | undefined, payoutId: string) {
  return call<NowPayoutBatch>({
    apiKey,
    baseUrl,
    method: "GET",
    path: `/v1/payout/${encodeURIComponent(payoutId)}`,
  });
}

/* ------------------------------------------------------------------ */
/* Assinatura IPN (HMAC-SHA512 sobre JSON com chaves ordenadas)         */
/* ------------------------------------------------------------------ */

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortDeep(src[k]);
    return out;
  }
  return value;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valida x-nowpayments-sig conforme documentação oficial. */
export async function verifyIpnSignature(
  admin: AdminClient,
  payload: unknown,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const secret = await loadSecretValue(admin, "ipn_secret");
  if (!secret) return false;
  const message = JSON.stringify(sortDeep(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message) as unknown as ArrayBuffer,
  );
  return timingSafeEqual(hex(mac), signature.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* TOTP (verificação 2FA do payout) — nunca exposto ao frontend         */
/* ------------------------------------------------------------------ */

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Gera o código TOTP (SHA-1, 6 dígitos, janela de 30s) a partir do segredo. */
export async function generateTotp(secret: string, timestampMs = Date.now()): Promise<string> {
  const counter = Math.floor(timestampMs / 1000 / 30);
  const buf = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, buf as unknown as ArrayBuffer),
  );
  const offset = mac[mac.length - 1]! & 0x0f;
  const code =
    (((mac[offset]! & 0x7f) << 24) |
      ((mac[offset + 1]! & 0xff) << 16) |
      ((mac[offset + 2]! & 0xff) << 8) |
      (mac[offset + 3]! & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

/** Status finais/intermediários oficiais de pagamento. */
export const PAYMENT_STATUSES = [
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "finished",
  "failed",
  "refunded",
  "expired",
] as const;

/** Status oficiais de payout. */
export const PAYOUT_STATUSES = [
  "creating",
  "waiting",
  "processing",
  "sending",
  "finished",
  "failed",
  "rejected",
] as const;
