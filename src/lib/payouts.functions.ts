import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";
import { checkWithdrawalWindow } from "@/lib/withdrawal-window";
import { pixKeyIsValid } from "@/lib/pix-keys";
import type { WithdrawalRow } from "@/lib/withdrawal-submit.server";

/**
 * Saques (cash-out PIX e withdraw USDT BEP20).
 *
 * PIX: até R$ 1.000 (AUTO_PIX_WITHDRAW_LIMIT) o saque é enviado automaticamente
 * à ConnectPay no momento da solicitação; acima disso, reserva saldo e fica
 * aguardando aprovação do administrador.
 * USDT: sem limite — sempre enviado automaticamente.
 */
const AUTO_PIX_WITHDRAW_LIMIT = 1000;


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

    const auto = data.amount <= AUTO_PIX_WITHDRAW_LIMIT;

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
      _auto: auto,
    });
    if (error) throw new Error(error.message);

    if (auto) {
      const { autoSubmitWithdrawal } = await import("./withdrawal-submit.server");
      return autoSubmitWithdrawal(supabaseAdmin, id as string);
    }

    const { notifyWithdrawalStatus } = await import("./whatsapp.server");
    await notifyWithdrawalStatus(supabaseAdmin, id as string);
    return {
      withdrawalId: id as string,
      auto: false,
      message: "Solicitação registrada — aguarda aprovação.",
    };
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

    const auto = true;

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
      _auto: auto,
    });
    if (error) throw new Error(error.message);

    if (auto) {
      const { autoSubmitWithdrawal } = await import("./withdrawal-submit.server");
      return autoSubmitWithdrawal(supabaseAdmin, id as string);
    }

    const { notifyWithdrawalStatus } = await import("./whatsapp.server");
    await notifyWithdrawalStatus(supabaseAdmin, id as string);
    return {
      withdrawalId: id as string,
      auto: false,
      message: "Solicitação registrada — aguarda aprovação.",
    };
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

    const { submitWithdrawalToGateway } = await import("./withdrawal-submit.server");
    return submitWithdrawalToGateway(supabaseAdmin, w as unknown as WithdrawalRow, {
      adminId: context.userId,
      mode: "admin",
    });
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
    const { notifyWithdrawalStatus } = await import("./whatsapp.server");
    await notifyWithdrawalStatus(supabaseAdmin, data.withdrawalId);
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

    // Legado (somente auditoria): saques antigos enviados à NOWPayments.
    // Consulta o status — nunca cria novos payouts nesse provedor.
    if (w.provider === "nowpayments") {
      const np = await import("./nowpayments.server");
      const payoutId = w.provider_payout_id ?? w.batch_withdrawal_id;
      if (!payoutId) {
        return {
          ok: false as const,
          message: "Saque legado sem identificador no provedor anterior.",
        };
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
        new_value: { provider: "nowpayments", legacy: true, reasons },
      });
      return {
        ok: true as const,
        message: `Status no provedor legado: ${reasons.join(", ") || "desconhecido"}`,
      };
    }

    // USDT ConnectPay: reconciliação automática pelo webhook crypto.
    if (w.currency === "USDT") {
      return {
        ok: false as const,
        message:
          "Saque USDT (ConnectPay): a confirmação é feita automaticamente pelo webhook crypto.",
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

    const { notifyWithdrawalStatus } = await import("./whatsapp.server");
    await notifyWithdrawalStatus(supabaseAdmin, w.id);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "withdrawal_reconciled",
      table_name: "withdrawals",
      record_id: w.id,
      new_value: { provider_status: status },
    });
    return { ok: true as const, message: `Status na ConnectPay: ${status || "desconhecido"}` };
  });
