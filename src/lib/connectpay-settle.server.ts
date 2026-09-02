/**
 * Liquidação segura de depósitos ConnectPay (server-only).
 *
 * Regra de ouro: nunca confiar apenas no payload do webhook. Para PIX o status
 * é reconsultado em GET /v1/transactions/{id} e todos os campos são conferidos
 * antes de creditar. O crédito em si é feito pela RPC atômica e idempotente
 * `credit_deposit`.
 */
import type { PixTransactionResponse } from "./connectpay.server";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

const CENT = 0.01;

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type SettleResult = { credited: boolean; reason: string };

export async function settlePixDeposit(
  admin: AdminClient,
  depositId: string,
  tx: PixTransactionResponse,
  source: string,
): Promise<SettleResult> {
  const { data: deposit } = await admin
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .maybeSingle();
  if (!deposit) return { credited: false, reason: "deposit_not_found" };
  if (deposit.credited_at) return { credited: false, reason: "already_credited" };

  const status = String(tx.status ?? "").toUpperCase();
  const method = String(tx.payment_method ?? "PIX").toUpperCase();
  const externalId = String(tx.external_id ?? "");
  const providerId = String(tx.id ?? "");
  const total = numeric(tx.total_value ?? tx.total_amount);

  if (status === "CHARGEBACK" || status === "IN_DISPUTE") {
    await admin
      .from("deposits")
      .update({
        status: status.toLowerCase(),
        failure_reason: `Ocorrência registrada pela ConnectPay: ${status}`,
        metadata: { provider_status: status, source },
      })
      .eq("id", deposit.id);
    return { credited: false, reason: status.toLowerCase() };
  }

  if (status === "FAILED") {
    await admin
      .from("deposits")
      .update({ status: "failed", metadata: { provider_status: status, source } })
      .eq("id", deposit.id);
    return { credited: false, reason: "failed" };
  }

  if (status !== "AUTHORIZED") return { credited: false, reason: "not_authorized" };
  if (method !== "PIX") return { credited: false, reason: "method_mismatch" };
  if (externalId && externalId !== deposit.external_id) {
    return { credited: false, reason: "external_id_mismatch" };
  }
  if (
    providerId &&
    deposit.provider_transaction_id &&
    providerId !== deposit.provider_transaction_id
  ) {
    return { credited: false, reason: "transaction_id_mismatch" };
  }
  if (total !== null && Math.abs(total - Number(deposit.amount)) > CENT) {
    return { credited: false, reason: "amount_mismatch" };
  }

  const { error } = await admin.rpc("credit_deposit", {
    _deposit: deposit.id,
    _payload: { provider_status: status, source, provider_transaction_id: providerId },
  });
  if (error) throw new Error(error.message);
  const { notifyDepositCredited } = await import("./whatsapp.server");
  await notifyDepositCredited(admin, deposit.id);
  return { credited: true, reason: "credited" };
}

export async function settleCryptoDeposit(
  admin: AdminClient,
  event: {
    transaction_id: string;
    status: string;
    asset: string;
    chain: string;
    amount: number | null;
    tx_hash: string | null;
    external_id: string | null;
    deposit_address?: string | null;
  },
  source: string,
): Promise<SettleResult> {
  const base = () => admin.from("deposits").select("*").eq("method", "crypto");

  const findDeposit = async () => {
    if (event.external_id) {
      const { data } = await base().eq("external_id", event.external_id).maybeSingle();
      if (data) return data;
    }
    if (event.transaction_id) {
      const { data } = await base()
        .eq("provider_transaction_id", event.transaction_id)
        .maybeSingle();
      if (data) return data;
    }
    if (event.deposit_address) {
      // A ConnectPay não devolve external_id no webhook de cripto: casa pelo endereço gerado.
      const { data } = await base()
        .ilike("pay_address", event.deposit_address)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    return null;
  };

  const deposit = await findDeposit();
  if (!deposit) return { credited: false, reason: "deposit_not_found" };



  const status = event.status.toUpperCase();

  if (status === "FAILED" || status === "CANCELED") {
    if (!deposit.credited_at) {
      await admin
        .from("deposits")
        .update({
          status: status.toLowerCase(),
          tx_hash: event.tx_hash ?? deposit.tx_hash,
          metadata: { provider_status: status, source },
        })
        .eq("id", deposit.id);
    }
    return { credited: false, reason: status.toLowerCase() };
  }

  if (status !== "CONFIRMED") {
    if (!deposit.credited_at) {
      await admin
        .from("deposits")
        .update({
          status: status === "PROCESSING" ? "processing" : "pending",
          tx_hash: event.tx_hash ?? deposit.tx_hash,
          metadata: { provider_status: status, source },
        })
        .eq("id", deposit.id);
    }
    return { credited: false, reason: "not_confirmed" };
  }

  if (deposit.credited_at) return { credited: false, reason: "already_credited" };
  if (deposit.currency !== "USDT" || event.asset.toUpperCase() !== "USDT") {
    return { credited: false, reason: "asset_mismatch" };
  }
  if ((deposit.network ?? "BEP20").toUpperCase() !== event.chain.toUpperCase()) {
    return { credited: false, reason: "chain_mismatch" };
  }
  // Pagamentos a maior são aceitos; só recusa se veio menos que o esperado.
  if (event.amount !== null && event.amount < Number(deposit.amount) - 0.01) {
    return { credited: false, reason: "amount_mismatch" };
  }

  if (
    deposit.provider_transaction_id &&
    event.transaction_id &&
    deposit.provider_transaction_id !== event.transaction_id
  ) {
    return { credited: false, reason: "transaction_id_mismatch" };
  }

  await admin
    .from("deposits")
    .update({
      tx_hash: event.tx_hash ?? deposit.tx_hash,
      provider_transaction_id: deposit.provider_transaction_id ?? event.transaction_id,
    })
    .eq("id", deposit.id);

  const { error } = await admin.rpc("credit_deposit", {
    _deposit: deposit.id,
    _payload: {
      provider_status: status,
      source,
      tx_hash: event.tx_hash,
      provider_transaction_id: event.transaction_id,
    },
  });
  if (error) throw new Error(error.message);
  const { notifyDepositCredited } = await import("./whatsapp.server");
  await notifyDepositCredited(admin, deposit.id);
  return { credited: true, reason: "credited" };
}

/** Registra o evento recebido (nunca grava credenciais). */
export async function recordWebhookEvent(
  admin: AdminClient,
  input: {
    eventType: string;
    status: string | null;
    providerTransactionId: string | null;
    externalId: string | null;
    payload: unknown;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: "connectpay",
      event_type: input.eventType,
      status: input.status,
      provider_transaction_id: input.providerTransactionId,
      external_id: input.externalId,
      payload: input.payload as never,
      processing_status: "received",
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function finishWebhookEvent(
  admin: AdminClient,
  eventId: string | null,
  status: string,
  error?: string,
): Promise<void> {
  if (!eventId) return;
  await admin
    .from("payment_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_status: status,
      error_message: error ?? null,
    })
    .eq("id", eventId);
}
