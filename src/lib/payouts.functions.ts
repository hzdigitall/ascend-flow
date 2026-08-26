import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";
import { checkWithdrawalWindow } from "@/lib/withdrawal-window";

/**
 * Saques (cash-out PIX e withdraw USDT BEP20).
 *
 * O usuário NUNCA dispara a ConnectPay: a solicitação apenas reserva saldo e
 * fica aguardando aprovação do administrador.
 */

const PIX_TYPE_MAP = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "EMAIL",
  phone: "PHONE",
  random: "RANDOM",
} as const;

function pixKeyIsValid(type: keyof typeof PIX_TYPE_MAP, key: string): boolean {
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

export const requestPixWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { wallet: string; amount: number; keyType: string; key: string }) =>
    z
      .object({
        wallet: z.enum(["earnings", "referral"]),
        amount: z.number().positive().max(1_000_000),
        keyType: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
        key: z.string().trim().min(3).max(140),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Mesmas janelas do USDT (horário de Brasília).
    const win = checkWithdrawalWindow(data.wallet);
    if (!win.isOpen) throw new Error(win.message);
    if (data.amount < 10) throw new Error("O valor mínimo para saque é R$ 10,00.");
    if (!pixKeyIsValid(data.keyType, data.key)) {
      throw new Error("Chave PIX inválida para o tipo selecionado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("request_withdrawal_v2", {
      _user: context.userId,
      _amount: data.amount,
      _wallet: data.wallet,
      _method: "pix",
      _currency: "BRL",
      _network: null as unknown as string,
      _key_type: data.keyType,
      _key: data.key,
      _address: null as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { withdrawalId: id as string };
  });

/**
 * Saque em USDT BEP20.
 * O usuário informa o valor EM REAIS a debitar do saldo; o backend aplica a
 * taxa existente e converte o líquido para USDT pela cotação vigente,
 * congelando a taxa na solicitação.
 */
export const requestUsdtWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { wallet: string; amount: number; address: string }) =>
    z
      .object({
        wallet: z.enum(["earnings", "referral"]),
        amount: z.number().positive().max(1_000_000),
        address: z
          .string()
          .trim()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Endereço BEP20 inválido"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Mesmas janelas do PIX (horário de Brasília).
    const win = checkWithdrawalWindow(data.wallet);
    if (!win.isOpen) throw new Error(win.message);
    if (data.amount < 10) throw new Error("O valor mínimo para saque é R$ 10,00.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");
    const gateway = await cp.loadGateway(supabaseAdmin);
    if (!gateway?.active || !gateway.usdt_withdraw_enabled) {
      throw new Error("Saques em USDT estão temporariamente indisponíveis.");
    }
    const { data: id, error } = await supabaseAdmin.rpc("request_withdrawal_v2", {
      _user: context.userId,
      _amount: data.amount,
      _wallet: data.wallet,
      _method: "crypto",
      _currency: "USDT",
      _network: "BEP20",
      _key_type: null as unknown as string,
      _key: null as unknown as string,
      _address: data.address,
    });
    if (error) throw new Error(error.message);
    return { withdrawalId: id as string };
  });


/* ------------------------------------------------------------------ */
/* Administração                                                       */
/* ------------------------------------------------------------------ */

export const adminApproveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withdrawalId: string }) =>
    z.object({ withdrawalId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Trava atômica contra duplo clique/duplo admin: pending -> submitting.
    const { data: w, error: lockError } = await supabaseAdmin.rpc("withdrawal_begin_submission", {
      _admin: context.userId,
      _wid: data.withdrawalId,
    });
    if (lockError) throw new Error(lockError.message);
    const withdrawal = w as unknown as {
      id: string;
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

    /* ---------------- USDT BEP20 -> NOWPayments ---------------- */
    if (withdrawal.currency === "USDT") {
      const np = await import("./nowpayments.server");

      let gateway: Awaited<ReturnType<typeof np.loadGateway>>;
      let apiKey: string;
      try {
        const active = await np.requireActiveGateway(supabaseAdmin, "usdt_withdraw");
        gateway = active.gateway;
        apiKey = active.apiKey;
      } catch {
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "pending" })
          .eq("id", withdrawal.id);
        throw new Error(
          "NOWPayments indisponível para payout: verifique credenciais, conexão e a ativação de saques USDT.",
        );
      }

      if ((withdrawal.network ?? "") !== "BEP20" || !withdrawal.wallet_address) {
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "failed", failure_reason: "Saque USDT inválido (rede/carteira)." })
          .eq("id", withdrawal.id);
        throw new Error("Saque USDT inválido (rede/carteira).");
      }

      // Saldo permanece reservado em qualquer falha desta etapa (nunca é liberado aqui).
      const fail = async (reason: string) => {
        await supabaseAdmin
          .from("withdrawals")
          .update({ status: "failed", failure_reason: reason })
          .eq("id", withdrawal.id);
        await supabaseAdmin.from("admin_logs").insert({
          admin_id: context.userId,
          action: "withdrawal_payout_blocked",
          table_name: "withdrawals",
          record_id: withdrawal.id,
          new_value: { reason },
        });
        throw new Error(reason);
      };

      // 1) Validação oficial do endereço para USDTBSC.
      try {
        await np.validateAddress(apiKey, gateway.base_url, withdrawal.wallet_address);
      } catch (err) {
        const status = err instanceof np.NowPaymentsError ? err.status : 500;
        await fail(
          status === 400
            ? "Carteira inválida para USDTBSC."
            : `Não foi possível validar a carteira: ${np.friendlyMessage(status)}`,
        );
      }

      // 2) JWT de curta duração (nunca persistido).
      let jwt: string;
      try {
        jwt = await np.getJwt(supabaseAdmin, gateway.base_url);
      } catch {
        await fail("Falha de autenticação de payout NOWPayments.");
        return { ok: false as const, message: "Falha de autenticação de payout NOWPayments." };
      }

      // 3) Criação do payout (amount com no máximo 6 casas decimais).
      const uniqueExternalId = withdrawal.unique_external_id ?? `arena-payout-${withdrawal.id}`;
      // Valor em USDT congelado no momento da solicitação (nunca recalculado).
      const frozen = withdrawal.crypto_amount;
      if (frozen === null || Number(frozen) <= 0) {
        await fail("Saque USDT sem valor convertido registrado. Rejeite e solicite novamente.");
      }
      const payoutAmount = Number(Number(frozen).toFixed(6));
      const urls = np.webhookUrls(gateway);
      let batch: Awaited<ReturnType<typeof np.createPayout>>;
      try {
        batch = await np.createPayout(apiKey, jwt, gateway.base_url, {
          ipn_callback_url: urls.payout,
          withdrawals: [
            {
              address: withdrawal.wallet_address,
              currency: np.PAY_CURRENCY,
              amount: payoutAmount,
              ipn_callback_url: urls.payout,
              unique_external_id: uniqueExternalId,
            },
          ],
        });
      } catch (err) {
        const status = err instanceof np.NowPaymentsError ? err.status : 500;
        await fail(
          status === 403
            ? "Payout bloqueado pela whitelist da NOWPayments. Verifique as configurações da conta."
            : `Falha ao criar o payout na NOWPayments: ${np.friendlyMessage(status)}`,
        );
        return { ok: false as const, message: "Falha ao criar o payout." };
      }

      const { extractPayoutItems, applyPayoutStatus } = await import(
        "./nowpayments-settle.server"
      );
      const items = extractPayoutItems(batch);
      const first = items[0];
      const batchId = batch.id === undefined || batch.id === null ? null : String(batch.id);

      await supabaseAdmin
        .from("withdrawals")
        .update({
          provider: np.PROVIDER,
          unique_external_id: uniqueExternalId,
          batch_withdrawal_id: first?.batchId ?? batchId,
          provider_payout_id: first?.payoutId ?? null,
          provider_transaction_id: first?.payoutId ?? batchId,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", withdrawal.id);

      await supabaseAdmin.rpc("withdrawal_mark_processing", {
        _wid: withdrawal.id,
        _provider_tx: first?.payoutId ?? batchId ?? "",
        _payload: { provider: np.PROVIDER, provider_status: first?.status ?? null } as never,
      });

      // 4) Verificação 2FA obrigatória do payout.
      const totpSecret = await np.loadSecretValue(supabaseAdmin, "totp_secret");
      const verifyTarget = first?.batchId ?? batchId;
      let message = "Payout criado — aguardando verificação 2FA NOWPayments.";
      if (totpSecret && verifyTarget) {
        try {
          const code = await np.generateTotp(totpSecret);
          await np.verifyPayout(apiKey, jwt, gateway.base_url, verifyTarget, code);
          message = "Payout criado e verificado (2FA). Envio em processamento na NOWPayments.";
        } catch (err) {
          const status = err instanceof np.NowPaymentsError ? err.status : 500;
          await supabaseAdmin
            .from("withdrawals")
            .update({
              failure_reason: `Payout criado, mas a verificação 2FA falhou: ${np.friendlyMessage(status)}`,
            })
            .eq("id", withdrawal.id);
          message = "Payout criado — verificação 2FA falhou. Verifique o 2FA na NOWPayments.";
        }
      }

      if (items.length > 0 && first) {
        await applyPayoutStatus(supabaseAdmin, first, "payout_create");
      }

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "withdrawal_sent_to_gateway",
        table_name: "withdrawals",
        record_id: withdrawal.id,
        new_value: { provider: np.PROVIDER, currency: "USDT", network: "BEP20" },
      });
      return { ok: true as const, message };
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
      const response = await cp.createPixCashout(
        secret,
        gateway!.base_url,
        {
          external_id: withdrawal.external_id ?? withdrawal.id,
          pix_key: withdrawal.pix_key_value,
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
        admin_id: context.userId,
        action: "withdrawal_sent_to_gateway",
        table_name: "withdrawals",
        record_id: withdrawal.id,
        new_value: { currency: withdrawal.currency, method: withdrawal.method },
      });
      return { ok: true as const, message: "Saque enviado à ConnectPay e em processamento." };
    } catch (err) {
      const detail =
        err instanceof cp.GatewayError ? err.message : "Falha ao enviar o saque à ConnectPay.";
      await supabaseAdmin.rpc("withdrawal_release", {
        _wid: withdrawal.id,
        _status: "failed",
        _reason: detail,
        _payload: { failed_at_submission: true } as never,
      });
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "withdrawal_submission_failed",
        table_name: "withdrawals",
        record_id: withdrawal.id,
        new_value: { detail },
      });
      throw new Error(detail);
    }
  });


export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withdrawalId: string; reason?: string }) =>
    z
      .object({ withdrawalId: z.string().uuid(), reason: z.string().trim().max(300).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("withdrawal_reject_admin", {
      _admin: context.userId,
      _wid: data.withdrawalId,
      _reason: data.reason ?? "Solicitação rejeitada pela administração.",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reconciliação: consulta o status real na ConnectPay sem criar novo saque. */
export const adminReconcileWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withdrawalId: string }) =>
    z.object({ withdrawalId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");

    const { data: w } = await supabaseAdmin
      .from("withdrawals")
      .select(
        "id, currency, provider, provider_transaction_id, provider_payout_id, batch_withdrawal_id, status",
      )
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!w) throw new Error("Saque não encontrado.");

    // USDT novo (NOWPayments): consulta GET /v1/payout/:id — nunca cria payout.
    if (w.provider === "nowpayments") {
      const np = await import("./nowpayments.server");
      const payoutId = w.provider_payout_id ?? w.batch_withdrawal_id;
      if (!payoutId) {
        return { ok: false as const, message: "Este saque ainda não foi enviado à NOWPayments." };
      }
      const gateway = await np.loadGateway(supabaseAdmin);
      const apiKey = await np.requireApiKey(supabaseAdmin);
      const batch = await np.getPayout(apiKey, gateway?.base_url, payoutId);
      const { extractPayoutItems, applyPayoutStatus } = await import(
        "./nowpayments-settle.server"
      );
      const items = extractPayoutItems(batch);
      const reasons: string[] = [];
      for (const item of items) {
        const r = await applyPayoutStatus(supabaseAdmin, item, "admin_reconcile");
        reasons.push(`${item.status || "?"}:${r.reason}`);
      }
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "withdrawal_reconciled",
        table_name: "withdrawals",
        record_id: w.id,
        new_value: { provider: "nowpayments", reasons },
      });
      return {
        ok: true as const,
        message: `Status na NOWPayments: ${reasons.join(", ") || "desconhecido"}`,
      };
    }

    // USDT histórico da ConnectPay continua sendo reconciliado pelo webhook crypto.
    if (w.currency === "USDT") {
      return {
        ok: false as const,
        message:
          "Saque USDT antigo (ConnectPay): reconciliação automática pelo webhook crypto do provedor original.",
      };
    }
    if (!w.provider_transaction_id) {
      return { ok: false as const, message: "Este saque ainda não foi enviado à ConnectPay." };
    }

    const gateway = await cp.loadGateway(supabaseAdmin);
    const secret = await cp.loadSecret(supabaseAdmin);
    const response = await cp.getPixCashout(secret, gateway?.base_url, w.provider_transaction_id);
    const status = String(response.status ?? "").toLowerCase();

    if (status === "approved") {
      await supabaseAdmin.rpc("withdrawal_complete", {
        _wid: w.id,
        _provider_tx: w.provider_transaction_id,
        _tx_hash: null as unknown as string,
        _payload: { provider_status: status, source: "reconcile" } as never,
      });
    } else if (status === "failed" || status === "rejected") {
      await supabaseAdmin.rpc("withdrawal_release", {
        _wid: w.id,
        _status: status === "rejected" ? "rejected" : "failed",
        _reason: `ConnectPay retornou status ${status}.`,
        _payload: { source: "reconcile" } as never,
      });
    } else {
      await supabaseAdmin.rpc("withdrawal_mark_processing", {
        _wid: w.id,
        _provider_tx: w.provider_transaction_id,
        _payload: { provider_status: status, source: "reconcile" } as never,
      });
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "withdrawal_reconciled",
      table_name: "withdrawals",
      record_id: w.id,
      new_value: { provider_status: status },
    });
    return { ok: true as const, message: `Status na ConnectPay: ${status || "desconhecido"}` };
  });
