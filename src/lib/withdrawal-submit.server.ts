/**
 * Envio de saques à ConnectPay (PIX/USDT).
 *
 * Compartilhado entre:
 * - aprovação manual do admin — mode "admin", registra admin_id nos logs;
 * - saques automáticos de até R$ 500 — mode "auto", sem admin; em caso de
 *   falha o saque volta para "pending" e entra na fila de análise manual,
 *   sem devolver/liberar o saldo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PIX_TYPE_MAP, normalizePixKey, pixKeyIsValid } from "./pix-keys";

export type WithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  net_amount: number;
  currency: string;
  method: string;
  provider: string | null;
  network: string | null;
  pix_key_type: string | null;
  pix_key_value: string | null;
  wallet_address: string | null;
  external_id: string | null;
  unique_external_id: string | null;
  idempotency_key: string | null;
  conversion_rate: number | null;
  crypto_amount: number | null;
};

interface SubmitOptions {
  /** null quando o envio é automático (sem admin). */
  adminId: string | null;
  /** "admin" mantém os comportamentos atuais de falha; "auto" não mexe no saldo. */
  mode: "admin" | "auto";
}

export async function submitWithdrawalToGateway(
  supabaseAdmin: SupabaseClient,
  withdrawal: WithdrawalRow,
  opts: SubmitOptions,
): Promise<{ ok: true; message: string }> {
  /* ---------------- USDT BEP20 -> ConnectPay ---------------- */
  if (withdrawal.currency === "USDT") {
    const cpc = await import("./connectpay.server");

    let cryptoGateway: Awaited<ReturnType<typeof cpc.loadGateway>>;
    let cryptoSecret: string;
    try {
      const active = await cpc.requireActiveGateway(supabaseAdmin, "usdt_withdraw");
      cryptoGateway = active.gateway;
      cryptoSecret = active.secret;
    } catch {
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "pending" })
        .eq("id", withdrawal.id);
      throw new Error(
        "ConnectPay indisponível para saque USDT: verifique credencial, conexão e a ativação de saques USDT.",
      );
    }

    if ((withdrawal.network ?? "") !== "BEP20" || !withdrawal.wallet_address) {
      if (opts.mode === "admin") {
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "failed", failure_reason: "Saque USDT inválido (rede/carteira)." })
          .eq("id", withdrawal.id);
      }
      throw new Error("Saque USDT inválido (rede/carteira).");
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawal.wallet_address)) {
      if (opts.mode === "admin") {
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "failed", failure_reason: "Carteira BEP20 inválida." })
          .eq("id", withdrawal.id);
      }
      throw new Error("Carteira BEP20 inválida.");
    }

    // Valor em USDT congelado no momento da solicitação (nunca recalculado).
    const frozen = withdrawal.crypto_amount;
    if (frozen === null || Number(frozen) <= 0) {
      if (opts.mode === "admin") {
        await supabaseAdmin
          .from("withdrawals")
          .update({
            status: "failed",
            failure_reason: "Saque USDT sem valor convertido registrado.",
          })
          .eq("id", withdrawal.id);
      }
      throw new Error(
        "Saque USDT sem valor convertido registrado. Rejeite e solicite novamente.",
      );
    }
    const payoutAmount = Number(Number(frozen).toFixed(6));
    const idempotencyKey =
      withdrawal.idempotency_key ?? `connectpay-usdt-withdraw-${withdrawal.id}`;

    try {
      const response = await cpc.createCryptoWithdraw(
        cryptoSecret,
        cryptoGateway.base_url,
        {
          asset: cpc.USDT_ASSET,
          chain: cpc.USDT_CHAIN,
          amount: payoutAmount.toFixed(6),
          wallet: withdrawal.wallet_address,
          webhook_url: cpc.webhookUrls(cryptoGateway).crypto,
        },
        idempotencyKey,
      );

      const providerTx = String(response.transaction_id ?? response.id ?? "") || "";

      await supabaseAdmin
        .from("withdrawals")
        .update({
          provider: cpc.PROVIDER,
          idempotency_key: idempotencyKey,
          provider_transaction_id: providerTx || null,
          tx_hash: response.tx_hash ?? null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", withdrawal.id);

      await supabaseAdmin.rpc("withdrawal_mark_processing", {
        _wid: withdrawal.id,
        _provider_tx: providerTx,
        _payload: {
          provider: cpc.PROVIDER,
          provider_status: response.status ?? null,
        } as never,
      });

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: opts.adminId,
        action: "withdrawal_sent_to_gateway",
        table_name: "withdrawals",
        record_id: withdrawal.id,
        new_value: { provider: cpc.PROVIDER, currency: "USDT", network: "BEP20" },
      });

      return {
        ok: true as const,
        message: "Saque USDT enviado à ConnectPay e em processamento.",
      };
    } catch (err) {
      const detail =
        err instanceof cpc.GatewayError
          ? err.message
          : "Falha ao enviar o saque USDT à ConnectPay.";
      if (opts.mode === "admin") {
        // Saldo permanece reservado: só é liberado por webhook/reconciliação definitiva.
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "failed", failure_reason: detail })
          .eq("id", withdrawal.id);
        await supabaseAdmin.from("admin_logs").insert({
          admin_id: opts.adminId,
          action: "withdrawal_submission_failed",
          table_name: "withdrawals",
          record_id: withdrawal.id,
          new_value: { detail, provider: cpc.PROVIDER },
        });
      }
      throw new Error(detail);
    }
  }

  /* ---------------- PIX -> ConnectPay (fluxo original) ---------------- */
  const cp = await import("./connectpay.server");
  let gateway: Awaited<ReturnType<typeof cp.loadGateway>>;
  let secret: string;
  try {
    const active = await cp.requireActiveGateway(supabaseAdmin, "pix_cashout");
    gateway = active.gateway;
    secret = active.secret;
  } catch {
    await supabaseAdmin
      .from("withdrawals")
      .update({ status: "pending", released_at: null })
      .eq("id", withdrawal.id);
    throw new Error(
      "ConnectPay indisponível: verifique a credencial e a ativação da gateway antes de aprovar.",
    );
  }

  const urls = cp.webhookUrls(gateway);
  const idempotencyKey = withdrawal.idempotency_key ?? `connectpay-withdraw-${withdrawal.id}`;

  try {
    const pixType = PIX_TYPE_MAP[(withdrawal.pix_key_type ?? "cpf") as keyof typeof PIX_TYPE_MAP];
    if (!withdrawal.pix_key_value) {
      throw new cp.GatewayError("Saque PIX sem chave cadastrada.", 400);
    }
    // A gateway recusa chaves com máscara (ex.: 143.098.529-12): envia normalizada.
    const pixKey = normalizePixKey(withdrawal.pix_key_type, withdrawal.pix_key_value);
    if (!pixKeyIsValid((withdrawal.pix_key_type ?? "cpf") as keyof typeof PIX_TYPE_MAP, pixKey)) {
      throw new cp.GatewayError("Chave PIX inválida para o tipo selecionado.", 400);
    }
    const response = await cp.createPixCashout(
      secret,
      gateway!.base_url,
      {
        external_id: withdrawal.external_id ?? withdrawal.id,
        pix_key: pixKey,
        pix_type: pixType,
        amount: Number(Number(withdrawal.net_amount).toFixed(2)),
        webhook_url: urls.pixCashOut,
      },
      idempotencyKey,
    );
    await supabaseAdmin.rpc("withdrawal_mark_processing", {
      _wid: withdrawal.id,
      _provider_tx: String(response.id ?? response.cashout_id ?? ""),
      _payload: { provider_status: response.status ?? null } as never,
    });

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: opts.adminId,
      action: "withdrawal_sent_to_gateway",
      table_name: "withdrawals",
      record_id: withdrawal.id,
      new_value: { currency: withdrawal.currency, method: withdrawal.method },
    });
    const wa = await import("./whatsapp.server");
    await wa.notifyWithdrawalStatus(supabaseAdmin, withdrawal.id);
    return { ok: true as const, message: "Saque enviado à ConnectPay e em processamento." };
  } catch (err) {
    const detail =
      err instanceof cp.GatewayError ? err.message : "Falha ao enviar o saque à ConnectPay.";
    if (opts.mode === "admin") {
      await supabaseAdmin.rpc("withdrawal_release", {
        _wid: withdrawal.id,
        _status: "failed",
        _reason: detail,
        _payload: { failed_at_submission: true } as never,
      });
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: opts.adminId,
        action: "withdrawal_submission_failed",
        table_name: "withdrawals",
        record_id: withdrawal.id,
        new_value: { detail },
      });
    }
    throw new Error(detail);
  }
}

/**
 * Fluxo automático (até R$ 500): trava o saque sem admin e envia à gateway.
 * Se o envio falhar, o saque volta para "pending" (saldo segue reservado) e
 * entra na fila de análise manual do admin.
 */
export async function autoSubmitWithdrawal(
  supabaseAdmin: SupabaseClient,
  withdrawalId: string,
): Promise<{ withdrawalId: string; auto: boolean; message: string }> {
  const { data: w, error: lockError } = await supabaseAdmin.rpc("withdrawal_auto_begin_submission", {
    _wid: withdrawalId,
  });
  if (lockError) throw new Error(lockError.message);
  const withdrawal = w as unknown as WithdrawalRow;

  try {
    const res = await submitWithdrawalToGateway(supabaseAdmin, withdrawal, {
      adminId: null,
      mode: "auto",
    });
    return { withdrawalId, auto: true, message: res.message };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Falha no envio automático.";
    await supabaseAdmin
      .from("withdrawals")
      .update({ status: "pending", submitted_at: null, failure_reason: null })
      .eq("id", withdrawalId);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: null,
      action: "withdrawal_auto_submission_failed",
      table_name: "withdrawals",
      record_id: withdrawalId,
      new_value: { detail },
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: withdrawal.user_id,
      title: "Saque em análise",
      body: "Seu saque não pôde ser enviado automaticamente e foi encaminhado para análise da administração.",
      type: "withdrawal",
    });
    return {
      withdrawalId,
      auto: false,
      message: "Saque registrado. O envio automático falhou e será analisado pela administração.",
    };
  }
}