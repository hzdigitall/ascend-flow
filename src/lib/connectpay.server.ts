/**
 * Serviço central ConnectPay (server-only).
 *
 * Nenhuma página/componente conversa diretamente com a ConnectPay: todas as
 * chamadas passam por aqui. O API Secret é carregado do cofre cifrado e nunca
 * é retornado, logado ou exposto ao frontend.
 *
 * Documentação oficial: https://docs.connectpay.vc/docs/introducao
 * Base de produção:     https://api.connectpay.vc
 */
import { decryptSecret } from "./gateway-vault.server";

export const PROVIDER = "connectpay" as const;
export const DEFAULT_BASE_URL = "https://api.connectpay.vc";
export const USDT_ASSET = "USDT" as const;
export const USDT_CHAIN = "BEP20" as const;

export type GatewayRow = {
  provider: string;
  active: boolean;
  environment: string;
  base_url: string;
  webhook_base_url: string | null;
  credentials_configured: boolean;
  credential_last_four: string | null;
  connection_status: string;
  last_connection_test?: string | null;
  last_error?: string | null;
  pix_cashin_enabled: boolean;
  pix_cashout_enabled: boolean;
  usdt_deposit_enabled: boolean;
  usdt_withdraw_enabled: boolean;
};

export class GatewayError extends Error {
  status: number;
  detail: string | null;
  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.detail = detail;
  }
}

/** Mensagem amigável (sem stack trace, sem credencial) por status HTTP. */
export function friendlyMessage(status: number): string {
  switch (status) {
    case 400:
      return "Dados inválidos para processar a operação.";
    case 401:
      return "Falha de autenticação com a ConnectPay. Verifique o API Secret.";
    case 403:
      return "Operação não autorizada pela ConnectPay.";
    case 404:
      return "Transação não encontrada na ConnectPay.";
    case 429:
      return "Muitas solicitações. Tente novamente em instantes.";
    case 503:
      return "Serviço da ConnectPay temporariamente indisponível.";
    default:
      return "Não foi possível processar sua solicitação neste momento.";
  }
}

export function webhookBaseUrl(gateway: GatewayRow | null): string {
  const base =
    gateway?.webhook_base_url ||
    process.env["APP_URL"] ||
    "https://project--35b87076-8266-43d0-9bc0-100b94a9dab0.lovable.app";
  return base.replace(/\/+$/, "");
}

export const webhookUrls = (gateway: GatewayRow | null) => {
  const base = webhookBaseUrl(gateway);
  return {
    pixCashIn: `${base}/api/public/webhooks/connectpay/pix`,
    pixCashOut: `${base}/api/public/webhooks/connectpay/cashout`,
    crypto: `${base}/api/public/webhooks/connectpay/crypto`,
  };
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function loadGateway(supabaseAdmin: AdminClient): Promise<GatewayRow | null> {
  const { data } = await supabaseAdmin
    .from("payment_gateways")
    .select("*")
    .eq("provider", PROVIDER)
    .maybeSingle();
  return (data as GatewayRow | null) ?? null;
}

/** Carrega o API Secret decifrado. Lança erro claro se não configurado. */
export async function loadSecret(supabaseAdmin: AdminClient): Promise<string> {
  const { data } = await supabaseAdmin
    .from("gateway_credentials")
    .select("ciphertext, iv")
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!data) throw new GatewayError("Credencial da ConnectPay não configurada.", 412);
  return decryptSecret(data.ciphertext, data.iv);
}

/**
 * Garante que a gateway está ativa, com credencial válida, e devolve o contexto
 * necessário para chamar a API. Use antes de qualquer operação financeira real.
 */
export async function requireActiveGateway(
  supabaseAdmin: AdminClient,
  feature: "pix_cashin" | "pix_cashout" | "usdt_deposit" | "usdt_withdraw",
): Promise<{ gateway: GatewayRow; secret: string }> {
  const gateway = await loadGateway(supabaseAdmin);
  const enabled =
    gateway &&
    gateway.active &&
    gateway.credentials_configured &&
    ({
      pix_cashin: gateway.pix_cashin_enabled,
      pix_cashout: gateway.pix_cashout_enabled,
      usdt_deposit: gateway.usdt_deposit_enabled,
      usdt_withdraw: gateway.usdt_withdraw_enabled,
    }[feature] ??
      false);

  if (!gateway || !enabled) {
    throw new GatewayError("Método de pagamento temporariamente indisponível.", 503);
  }
  const secret = await loadSecret(supabaseAdmin);
  return { gateway, secret };
}

async function call<T>(options: {
  secret: string;
  baseUrl?: string | undefined;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string | undefined;
}): Promise<T> {
  const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "api-secret": options.secret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${base}${options.path}`, {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new GatewayError("Não foi possível contatar a ConnectPay.", 503);
  }

  const raw = await response.text();
  if (!response.ok) {
    // Nunca logamos headers (onde vive o api-secret), apenas status + corpo.
    console.error(`[connectpay] ${options.method} ${options.path} -> ${response.status}`);
    throw new GatewayError(friendlyMessage(response.status), response.status, raw.slice(0, 800));
  }
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new GatewayError("Resposta inválida da ConnectPay.", 502);
  }
}

/* ---------------------------------------------------------------- */
/* Endpoints oficiais                                               */
/* ---------------------------------------------------------------- */

export type AccountInfo = Record<string, unknown>;

/** GET /v1/account-info */
export function getAccountInfo(secret: string, baseUrl?: string) {
  return call<AccountInfo>({ secret, baseUrl, method: "GET", path: "/v1/account-info" });
}

export type PixTransactionResponse = {
  id?: string;
  external_id?: string;
  status?: string;
  total_value?: number;
  total_amount?: number;
  payment_method?: string;
  pix?: { payload?: string; qr_code?: string; expires_at?: string };
  [key: string]: unknown;
};

/** POST /v1/transactions — cobrança PIX (cash-in) */
export function createPixTransaction(
  secret: string,
  baseUrl: string | undefined,
  body: {
    external_id: string;
    total_amount: number;
    payment_method: "PIX";
    webhook_url: string;
    items: Array<{
      id: string;
      title: string;
      price: number;
      quantity: number;
      is_physical: boolean;
    }>;
    customer: {
      name: string;
      email: string;
      phone: string;
      document_type: "CPF" | "CNPJ";
      document: string;
    };
  },
) {
  return call<PixTransactionResponse>({
    secret,
    baseUrl,
    method: "POST",
    path: "/v1/transactions",
    body,
  });
}

/** GET /v1/transactions/{transaction_id} */
export function getPixTransaction(secret: string, baseUrl: string | undefined, id: string) {
  return call<PixTransactionResponse>({
    secret,
    baseUrl,
    method: "GET",
    path: `/v1/transactions/${encodeURIComponent(id)}`,
  });
}

export type CashoutResponse = {
  id?: string;
  cashout_id?: string;
  external_id?: string;
  status?: string;
  amount?: number;
  [key: string]: unknown;
};

/** POST /v1/cashout — saque PIX real */
export function createPixCashout(
  secret: string,
  baseUrl: string | undefined,
  body: {
    external_id: string;
    pix_key: string;
    pix_type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
    amount: number;
    webhook_url: string;
  },
  idempotencyKey?: string,
) {
  return call<CashoutResponse>({
    secret,
    baseUrl,
    method: "POST",
    path: "/v1/cashout",
    body,
    idempotencyKey,
  });
}

/** GET /v1/cashout/{cashoutId} */
export function getPixCashout(secret: string, baseUrl: string | undefined, id: string) {
  return call<CashoutResponse>({
    secret,
    baseUrl,
    method: "GET",
    path: `/v1/cashout/${encodeURIComponent(id)}`,
  });
}

export type CryptoDepositResponse = {
  transaction_id?: string;
  id?: string;
  asset?: string;
  chain?: string;
  amount?: string | number;
  net_amount?: string | number;
  fee?: string | number;
  deposit_address?: string;
  qr_code?: string;
  expires_at?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
};

/** POST /v1/crypto/deposits — depósito USDT BEP20 */
export function createCryptoDeposit(
  secret: string,
  baseUrl: string | undefined,
  body: { asset: "USDT"; chain: "BEP20"; amount: string; webhook_url: string },
  idempotencyKey: string,
) {
  return call<CryptoDepositResponse>({
    secret,
    baseUrl,
    method: "POST",
    path: "/v1/crypto/deposits",
    body,
    idempotencyKey,
  });
}

export type CryptoWithdrawResponse = {
  transaction_id?: string;
  id?: string;
  status?: string;
  tx_hash?: string;
  fee?: string | number;
  [key: string]: unknown;
};

/** POST /v1/crypto/withdraws — saque USDT BEP20 */
export function createCryptoWithdraw(
  secret: string,
  baseUrl: string | undefined,
  body: {
    asset: "USDT";
    chain: "BEP20";
    amount: string;
    wallet: string;
    webhook_url: string;
  },
  idempotencyKey: string,
) {
  return call<CryptoWithdrawResponse>({
    secret,
    baseUrl,
    method: "POST",
    path: "/v1/crypto/withdraws",
    body,
    idempotencyKey,
  });
}
