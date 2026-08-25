import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Depósitos.
 *  - PIX (BRL)          -> ConnectPay  (fluxo original preservado)
 *  - USDT BEP20/USDTBSC -> NOWPayments (nova integração)
 */

export const getDepositMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadGateway } = await import("./connectpay.server");
    const np = await import("./nowpayments.server");

    const cpGateway = await loadGateway(supabaseAdmin);
    const cpReady = Boolean(cpGateway?.active && cpGateway.credentials_configured);

    const npGateway = await np.loadGateway(supabaseAdmin);
    const npReady = Boolean(npGateway?.active && npGateway.credentials_configured);

    return {
      pix: cpReady && Boolean(cpGateway?.pix_cashin_enabled),
      usdt: npReady && Boolean(npGateway?.usdt_deposit_enabled),
      usdtTicker: np.PAY_CURRENCY_LABEL,
      usdtNetwork: np.NETWORK_LABEL,
      unavailableMessage: "Método de pagamento temporariamente indisponível.",
    };
  });

export const createPixDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) =>
    z.object({ amount: z.number().positive().max(1_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");

    const { gateway, secret } = await cp.requireActiveGateway(supabaseAdmin, "pix_cashin");

    // Limites existentes do sistema (settings), sem inventar novas regras.
    const { data: minSetting } = await supabaseAdmin.rpc("get_setting", {
      _key: "deposit_min",
      _default: 20 as unknown as never,
    });
    const { data: maxSetting } = await supabaseAdmin.rpc("get_setting", {
      _key: "deposit_max",
      _default: 50000 as unknown as never,
    });
    const min = Number(minSetting ?? 20);
    const max = Number(maxSetting ?? 50000);
    if (data.amount < min) throw new Error(`Valor mínimo de depósito: R$ ${min.toFixed(2)}`);
    if (data.amount > max) throw new Error(`Valor máximo de depósito: R$ ${max.toFixed(2)}`);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone, cpf")
      .eq("id", context.userId)
      .maybeSingle();

    const document = (profile?.cpf ?? "").replace(/\D/g, "");
    const phone = (profile?.phone ?? "").replace(/\D/g, "");
    if (!profile?.full_name || !profile.email || document.length < 11 || phone.length < 10) {
      throw new Error(
        "Complete seu perfil (nome, e-mail, WhatsApp e CPF) em Minha conta antes de depositar.",
      );
    }

    const amount = Number(data.amount.toFixed(2));
    const depositId = crypto.randomUUID();

    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        id: depositId,
        user_id: context.userId,
        method: "pix",
        currency: "BRL",
        amount,
        external_id: depositId,
        idempotency_key: `connectpay-deposit-${depositId}`,
        status: "pending",
        provider: cp.PROVIDER,
      })
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível registrar o depósito.");

    try {
      const response = await cp.createPixTransaction(secret, gateway.base_url, {
        external_id: deposit.external_id,
        total_amount: amount,
        payment_method: "PIX",
        webhook_url: cp.webhookUrls(gateway).pixCashIn,
        items: [
          {
            id: deposit.id,
            title: "Depósito em conta Arena Saúde",
            price: amount,
            quantity: 1,
            is_physical: false,
          },
        ],
        customer: {
          name: profile.full_name,
          email: profile.email,
          phone,
          document_type: document.length > 11 ? "CNPJ" : "CPF",
          document,
        },
      });

      const payload = response.pix?.payload ?? null;
      if (!payload) throw new cp.GatewayError("A ConnectPay não retornou o código PIX.", 502);

      await supabaseAdmin
        .from("deposits")
        .update({
          provider_transaction_id: String(response.id ?? ""),
          pix_payload: payload,
          status: String(response.status ?? "PENDING").toUpperCase() === "AUTHORIZED"
            ? "authorized"
            : "pending",
          expires_at: response.pix?.expires_at ?? null,
          metadata: { provider_status: response.status ?? null },
        })
        .eq("id", deposit.id);

      return { depositId: deposit.id };
    } catch (err) {
      const message =
        err instanceof cp.GatewayError
          ? err.message
          : "Não foi possível processar sua solicitação neste momento.";
      await supabaseAdmin
        .from("deposits")
        .update({ status: "failed", failure_reason: message })
        .eq("id", deposit.id);
      throw new Error(message);
    }
  });

/** Depósito USDT BEP20 — NOWPayments (ticker USDTBSC). */
export const createUsdtDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) =>
    z.object({ amount: z.number().positive().max(1_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");

    const { gateway, apiKey } = await np.requireActiveGateway(supabaseAdmin, "usdt_deposit");

    // Limite interno existente.
    const { data: minSetting } = await supabaseAdmin.rpc("get_setting", {
      _key: "usdt_deposit_min",
      _default: 10 as unknown as never,
    });
    const min = Number(minSetting ?? 10);
    if (data.amount < min) throw new Error(`Valor mínimo de depósito: ${min} USDT`);

    // Mínimo oficial do par (nunca inventamos conversão).
    try {
      const official = await np.getMinAmount(apiKey, gateway.base_url, "usdt", np.PAY_CURRENCY);
      const officialMin = Number(official.min_amount ?? 0);
      if (officialMin > 0 && data.amount < officialMin) {
        throw new np.NowPaymentsError(
          `Valor mínimo aceito pela NOWPayments: ${officialMin} USDT.`,
          400,
        );
      }
    } catch (err) {
      if (err instanceof np.NowPaymentsError && err.status === 400) throw new Error(err.message);
      // Indisponibilidade de consulta do mínimo não impede a criação da cobrança.
    }

    const depositId = crypto.randomUUID();
    const amount = Number(data.amount.toFixed(8));

    // 1) Registro interno ANTES de chamar a NOWPayments (order_id = id do depósito).
    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        id: depositId,
        user_id: context.userId,
        method: "crypto",
        currency: "USDT",
        network: np.NETWORK,
        amount,
        expected_amount: amount,
        external_id: depositId,
        order_id: depositId,
        idempotency_key: `nowpayments-deposit-${depositId}`,
        status: "creating",
        provider: np.PROVIDER,
      })
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível registrar o depósito.");

    try {
      const response = await np.createPayment(apiKey, gateway.base_url, {
        price_amount: amount,
        price_currency: "usdt",
        pay_currency: np.PAY_CURRENCY,
        order_id: depositId,
        order_description: "Depósito em conta Arena Saúde",
        ipn_callback_url: np.webhookUrls(gateway).payment,
      });

      const payAddress = response.pay_address ? String(response.pay_address) : null;
      const paymentId = response.payment_id === undefined ? null : String(response.payment_id);
      if (!payAddress || !paymentId) {
        throw new np.NowPaymentsError("A NOWPayments não retornou o endereço de pagamento.", 502);
      }

      await supabaseAdmin
        .from("deposits")
        .update({
          provider_transaction_id: paymentId,
          purchase_id:
            response.purchase_id === undefined || response.purchase_id === null
              ? null
              : String(response.purchase_id),
          pay_address: payAddress,
          deposit_address: payAddress,
          expected_amount:
            response.pay_amount === undefined ? amount : Number(response.pay_amount),
          payment_status: String(response.payment_status ?? "waiting").toLowerCase(),
          status: "pending",
          expires_at:
            (response.valid_until as string | null) ??
            (response.expiration_estimate_date as string | null) ??
            null,
          metadata: {
            provider: np.PROVIDER,
            pay_currency: String(response.pay_currency ?? np.PAY_CURRENCY),
            price_amount: response.price_amount ?? amount,
            price_currency: response.price_currency ?? "usdt",
            payin_extra_id: response.payin_extra_id ?? null,
            network: response.network ?? np.NETWORK,
          } as never,
        })
        .eq("id", deposit.id);

      return { depositId: deposit.id };
    } catch (err) {
      const message =
        err instanceof np.NowPaymentsError
          ? err.message
          : "Não foi possível processar sua solicitação neste momento.";
      await supabaseAdmin
        .from("deposits")
        .update({ status: "failed", failure_reason: message })
        .eq("id", deposit.id);
      throw new Error(message);
    }
  });

/** Consulta o status real no backend (nunca credita manualmente pelo frontend). */
export const refreshDepositStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { depositId: string }) =>
    z.object({ depositId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");

    const { data: deposit } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", data.depositId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deposit) throw new Error("Depósito não encontrado.");
    if (deposit.credited_at) return { status: "credited" as const };

    if (deposit.provider === "nowpayments" && deposit.provider_transaction_id) {
      const np = await import("./nowpayments.server");
      try {
        const gateway = await np.loadGateway(supabaseAdmin);
        const apiKey = await np.requireApiKey(supabaseAdmin);
        const payment = await np.getPayment(
          apiKey,
          gateway?.base_url,
          deposit.provider_transaction_id,
        );
        const { settleNowPayment } = await import("./nowpayments-settle.server");
        await settleNowPayment(supabaseAdmin, payment, "manual_refresh");
      } catch {
        // silencioso para o usuário; status local é retornado abaixo
      }
    } else if (deposit.method === "pix" && deposit.provider_transaction_id) {
      const gateway = await cp.loadGateway(supabaseAdmin);
      if (gateway?.credentials_configured) {
        try {
          const secret = await cp.loadSecret(supabaseAdmin);
          const tx = await cp.getPixTransaction(
            secret,
            gateway.base_url,
            deposit.provider_transaction_id,
          );
          const { settlePixDeposit } = await import("./connectpay-settle.server");
          await settlePixDeposit(supabaseAdmin, deposit.id, tx, "manual_refresh");
        } catch {
          // silencioso para o usuário; status local é retornado abaixo
        }
      }
    }

    const { data: fresh } = await supabaseAdmin
      .from("deposits")
      .select("status, credited_at, payment_status")
      .eq("id", data.depositId)
      .maybeSingle();
    return {
      status: fresh?.credited_at ? ("credited" as const) : (fresh?.status ?? "pending"),
      paymentStatus: fresh?.payment_status ?? null,
    };
  });
