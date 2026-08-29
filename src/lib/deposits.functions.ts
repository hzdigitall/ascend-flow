import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Depósitos.
 *  - PIX (BRL)   -> ConnectPay
 *  - USDT BEP20  -> ConnectPay (asset USDT, chain BEP20)
 */

export const getDepositMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");
    const { currentUsdtRate } = await import("./usdt.server");

    const gateway = await cp.loadGateway(supabaseAdmin);
    const ready = Boolean(gateway?.active && gateway.credentials_configured);

    return {
      pix: ready && Boolean(gateway?.pix_cashin_enabled),
      usdt: ready && Boolean(gateway?.usdt_deposit_enabled),
      usdtTicker: cp.USDT_ASSET,
      usdtNetwork: cp.USDT_CHAIN,
      usdtRate: await currentUsdtRate(supabaseAdmin),
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
        ip: await cp.clientIp(),
        items: [
          {
            id: deposit.id,
            title: "Depósito em conta Arena Suplementos",
            description: "Depósito em conta Arena Suplementos",
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

/**
 * Depósito USDT BEP20 — ConnectPay (asset USDT, chain BEP20).
 * O usuário informa quanto quer ADICIONAR AO SALDO EM REAIS; o backend converte
 * pela cotação interna vigente e congela a taxa no registro do depósito.
 */
export const createUsdtDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { brlAmount: number }) =>
    z.object({ brlAmount: z.number().positive().max(1_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");
    const { currentUsdtRate, toUsdt } = await import("./usdt.server");

    const { gateway, secret } = await cp.requireActiveGateway(supabaseAdmin, "usdt_deposit");

    // Limites em BRL (mesmas configurações do PIX).
    const { data: minSetting } = await supabaseAdmin.rpc("get_setting", {
      _key: "deposit_min",
      _default: 20 as unknown as never,
    });
    const { data: maxSetting } = await supabaseAdmin.rpc("get_setting", {
      _key: "deposit_max",
      _default: 50000 as unknown as never,
    });
    const minBrl = Number(minSetting ?? 20);
    const maxBrl = Number(maxSetting ?? 50000);
    const brlAmount = Number(data.brlAmount.toFixed(2));
    if (brlAmount < minBrl) throw new Error(`Valor mínimo de depósito: R$ ${minBrl.toFixed(2)}`);
    if (brlAmount > maxBrl) throw new Error(`Valor máximo de depósito: R$ ${maxBrl.toFixed(2)}`);

    // Conversão SEMPRE calculada no backend com a cotação vigente.
    const rate = await currentUsdtRate(supabaseAdmin);
    const amount = toUsdt(brlAmount, rate);
    if (amount <= 0) throw new Error("Valor convertido em USDT inválido.");

    const depositId = crypto.randomUUID();
    const idempotencyKey = `connectpay-usdt-deposit-${depositId}`;

    // 1) Registro interno ANTES de chamar a ConnectPay.
    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        id: depositId,
        user_id: context.userId,
        method: "crypto",
        currency: "USDT",
        network: cp.USDT_CHAIN,
        amount,
        expected_amount: amount,
        crypto_amount: amount,
        conversion_rate: rate,
        brl_amount: brlAmount,
        payment_purpose: "wallet_deposit",
        external_id: depositId,
        order_id: depositId,
        idempotency_key: idempotencyKey,
        status: "creating",
        provider: cp.PROVIDER,
      })
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível registrar o depósito.");

    try {
      const response = await cp.createCryptoDeposit(
        secret,
        gateway.base_url,
        {
          asset: cp.USDT_ASSET,
          chain: cp.USDT_CHAIN,
          amount: amount.toFixed(6),
          webhook_url: cp.webhookUrls(gateway).crypto,
        },
        idempotencyKey,
      );

      const address = cp.extractDepositAddress(response);
      const transactionId = String(response.transaction_id ?? response.id ?? "") || null;
      if (!address) {
        cp.logMissingAddress("usdt-deposit", response);
        throw new cp.GatewayError("A ConnectPay não retornou o endereço de depósito.", 502);
      }

      await supabaseAdmin
        .from("deposits")
        .update({
          provider_transaction_id: transactionId,
          deposit_address: address,
          pay_address: address,
          qr_code: cp.extractQrCode(response),

          gateway_fee: response.fee === undefined ? 0 : Number(response.fee),
          net_amount: response.net_amount === undefined ? null : Number(response.net_amount),
          expected_amount: response.amount === undefined ? amount : Number(response.amount),
          payment_status: String(response.status ?? "PENDING_CONFIRMATION").toLowerCase(),
          status: "pending",
          expires_at: response.expires_at ?? null,
          metadata: {
            provider: cp.PROVIDER,
            asset: cp.USDT_ASSET,
            chain: cp.USDT_CHAIN,
            conversion_rate: rate,
            brl_amount: brlAmount,
            provider_status: response.status ?? null,
          } as never,
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
