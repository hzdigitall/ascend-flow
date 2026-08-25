/**
 * Liquidação segura de operações NOWPayments (server-only).
 *
 * Regras de ouro:
 *  - crédito definitivo somente em `finished` e com pay_currency = usdtbsc;
 *  - `partially_paid` nunca credita: registra o parcial e alerta o Admin;
 *  - idempotência garantida pela RPC atômica `credit_deposit` + credited_at;
 *  - reserva de saque só é liberada em estado definitivo (failed/rejected).
 */
import { PAY_CURRENCY, PROVIDER, type NowPayment, type NowPayoutBatch } from "./nowpayments.server";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type SettleResult = { credited: boolean; reason: string };

const EPS = 0.00000001;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Registra o evento recebido (payload cru, nunca credenciais). */
export async function recordNowWebhookEvent(
  admin: AdminClient,
  input: {
    eventType: string;
    status: string | null;
    providerTransactionId: string | null;
    externalId: string | null;
    payload: unknown;
    signatureValid: boolean;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: PROVIDER,
      event_type: input.eventType,
      status: input.status,
      provider_transaction_id: input.providerTransactionId,
      external_id: input.externalId,
      payload: input.payload as never,
      signature_valid: input.signatureValid,
      processing_status: input.signatureValid ? "received" : "invalid_signature",
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function finishNowWebhookEvent(
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

/* ------------------------------------------------------------------ */
/* Depósitos                                                           */
/* ------------------------------------------------------------------ */

export async function settleNowPayment(
  admin: AdminClient,
  payment: NowPayment,
  source: string,
): Promise<SettleResult> {
  const paymentId = payment.payment_id === undefined ? "" : String(payment.payment_id);
  const orderId = payment.order_id ? String(payment.order_id) : null;
  const status = String(payment.payment_status ?? "").toLowerCase();
  const payCurrency = String(payment.pay_currency ?? "").toLowerCase();
  const payAmount = num(payment.pay_amount);
  const actuallyPaid = num(payment.actually_paid) ?? 0;

  let query = admin.from("deposits").select("*").eq("provider", PROVIDER);
  query = orderId
    ? query.eq("order_id", orderId)
    : query.eq("provider_transaction_id", paymentId);
  const { data: deposit } = await query.maybeSingle();
  if (!deposit) return { credited: false, reason: "deposit_not_found" };

  // Vínculo forte: o payment_id gravado precisa bater com o do evento.
  if (paymentId && deposit.provider_transaction_id && deposit.provider_transaction_id !== paymentId) {
    return { credited: false, reason: "payment_id_mismatch" };
  }

  const basePatch = {
    payment_status: status,
    actually_paid: actuallyPaid,
    ...(payAmount !== null ? { expected_amount: payAmount } : {}),
    ...(payment.purchase_id !== undefined && payment.purchase_id !== null
      ? { purchase_id: String(payment.purchase_id) }
      : {}),
    ...(payment.pay_address ? { pay_address: String(payment.pay_address) } : {}),
    metadata: {
      ...((deposit.metadata as Record<string, unknown> | null) ?? {}),
      provider_status: status,
      source,
      updated_at: new Date().toISOString(),
    } as never,
  };

  if (deposit.credited_at) {
    await admin.from("deposits").update(basePatch).eq("id", deposit.id);
    return { credited: false, reason: "already_credited" };
  }

  // Estados que nunca creditam.
  if (status === "waiting" || status === "confirming" || status === "confirmed" || status === "sending") {
    await admin
      .from("deposits")
      .update({ ...basePatch, status: status === "waiting" ? "pending" : "processing" })
      .eq("id", deposit.id);
    return { credited: false, reason: `not_final:${status}` };
  }

  if (status === "partially_paid") {
    await admin
      .from("deposits")
      .update({
        ...basePatch,
        status: "partially_paid",
        failure_reason: "Pagamento parcial recebido. Aguardando regularização/confirmação.",
      })
      .eq("id", deposit.id);
    return { credited: false, reason: "partially_paid" };
  }

  if (status === "failed" || status === "expired" || status === "refunded") {
    await admin
      .from("deposits")
      .update({
        ...basePatch,
        status: status,
        failure_reason:
          status === "expired"
            ? "Pagamento expirado."
            : status === "refunded"
              ? "Pagamento estornado pela NOWPayments."
              : "Pagamento não concluído pela NOWPayments.",
      })
      .eq("id", deposit.id);
    return { credited: false, reason: status };
  }

  if (status !== "finished") return { credited: false, reason: `unknown_status:${status}` };

  // Validações antes do crédito definitivo.
  if (payCurrency && payCurrency !== PAY_CURRENCY) {
    await admin.from("deposits").update(basePatch).eq("id", deposit.id);
    return { credited: false, reason: "pay_currency_mismatch" };
  }
  const expected = payAmount ?? num(deposit.expected_amount) ?? Number(deposit.amount);
  if (actuallyPaid + EPS < expected) {
    await admin
      .from("deposits")
      .update({
        ...basePatch,
        status: "partially_paid",
        failure_reason: "Pagamento parcial recebido. Aguardando regularização/confirmação.",
      })
      .eq("id", deposit.id);
    return { credited: false, reason: "amount_below_expected" };
  }

  // Credita exatamente o valor recebido (ledger fiel ao caixa).
  await admin
    .from("deposits")
    .update({
      ...basePatch,
      amount: actuallyPaid,
      provider_transaction_id: deposit.provider_transaction_id ?? paymentId,
    })
    .eq("id", deposit.id);

  const { error } = await admin.rpc("credit_deposit", {
    _deposit: deposit.id,
    _payload: {
      provider: PROVIDER,
      provider_status: status,
      source,
      payment_id: paymentId,
      actually_paid: actuallyPaid,
    } as never,
  });
  if (error) throw new Error(error.message);
  return { credited: true, reason: "credited" };
}

/* ------------------------------------------------------------------ */
/* Saques (payout)                                                     */
/* ------------------------------------------------------------------ */

export type PayoutItem = {
  status: string;
  hash: string | null;
  error: string | null;
  payoutId: string | null;
  batchId: string | null;
  uniqueExternalId: string | null;
};

export function extractPayoutItems(batch: NowPayoutBatch): PayoutItem[] {
  const batchId = batch.id === undefined || batch.id === null ? null : String(batch.id);
  const list = Array.isArray(batch.withdrawals) ? batch.withdrawals : [];
  if (list.length === 0) {
    return [
      {
        status: String((batch as Record<string, unknown>)["status"] ?? "").toLowerCase(),
        hash: ((batch as Record<string, unknown>)["hash"] as string | null) ?? null,
        error: ((batch as Record<string, unknown>)["error"] as string | null) ?? null,
        payoutId: batchId,
        batchId,
        uniqueExternalId:
          ((batch as Record<string, unknown>)["unique_external_id"] as string | null) ?? null,
      },
    ];
  }
  return list.map((w) => ({
    status: String(w.status ?? "").toLowerCase(),
    hash: (w.hash as string | null) ?? null,
    error: (w.error as string | null) ?? null,
    payoutId: w.id === undefined || w.id === null ? null : String(w.id),
    batchId:
      w.batch_withdrawal_id === undefined || w.batch_withdrawal_id === null
        ? batchId
        : String(w.batch_withdrawal_id),
    uniqueExternalId: (w.unique_external_id as string | null) ?? null,
  }));
}

/** Aplica o status oficial de payout ao saque interno correspondente. */
export async function applyPayoutStatus(
  admin: AdminClient,
  item: PayoutItem,
  source: string,
): Promise<{ applied: boolean; reason: string }> {
  let query = admin.from("withdrawals").select("*").eq("provider", PROVIDER);
  if (item.uniqueExternalId) query = query.eq("unique_external_id", item.uniqueExternalId);
  else if (item.payoutId) query = query.eq("provider_payout_id", item.payoutId);
  else if (item.batchId) query = query.eq("batch_withdrawal_id", item.batchId);
  else return { applied: false, reason: "no_identifier" };

  const { data: w } = await query.maybeSingle();
  if (!w) return { applied: false, reason: "withdrawal_not_found" };

  await admin
    .from("withdrawals")
    .update({
      ...(item.payoutId ? { provider_payout_id: item.payoutId } : {}),
      ...(item.batchId ? { batch_withdrawal_id: item.batchId } : {}),
      ...(item.hash ? { tx_hash: item.hash } : {}),
      metadata: {
        ...((w.metadata as Record<string, unknown> | null) ?? {}),
        payout_status: item.status,
        payout_error: item.error,
        source,
      } as never,
    })
    .eq("id", w.id);

  if (item.status === "finished") {
    await admin.rpc("withdrawal_complete", {
      _wid: w.id,
      _provider_tx: item.payoutId ?? w.provider_transaction_id ?? "",
      _tx_hash: (item.hash ?? null) as unknown as string,
      _payload: { provider: PROVIDER, provider_status: item.status, source } as never,
    });
    return { applied: true, reason: "completed" };
  }

  if (item.status === "rejected") {
    // Estado definitivo: libera a reserva uma única vez.
    await admin.rpc("withdrawal_release", {
      _wid: w.id,
      _status: "rejected",
      _reason: item.error ?? "Payout rejeitado pela NOWPayments.",
      _payload: { provider: PROVIDER, source } as never,
    });
    return { applied: true, reason: "rejected" };
  }

  if (item.status === "failed") {
    // Nunca recriar payout automaticamente: apenas marca falha para revisão.
    await admin
      .from("withdrawals")
      .update({
        status: "failed",
        failure_reason:
          item.error ?? "Payout falhou na NOWPayments. Verifique o status antes de reenviar.",
      })
      .eq("id", w.id);
    return { applied: true, reason: "failed_manual_review" };
  }

  // creating | waiting | processing | sending -> mantém reserva
  await admin.rpc("withdrawal_mark_processing", {
    _wid: w.id,
    _provider_tx: item.payoutId ?? "",
    _payload: { provider: PROVIDER, provider_status: item.status, source } as never,
  });
  return { applied: true, reason: `processing:${item.status}` };
}
