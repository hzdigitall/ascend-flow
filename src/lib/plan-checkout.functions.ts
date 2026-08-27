import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Aquisição de plano paga diretamente por PIX ou USDT BEP20 — ambos via
 * ConnectPay.
 *
 * O pagamento é criado com finalidade `plan_purchase`: quando confirmado, o
 * valor é aplicado DIRETAMENTE no plano (a RPC `credit_deposit` chama
 * `confirm_payment`), nunca creditado como saldo livre. Toda conversão é
 * calculada no backend com a cotação interna vigente e congelada no registro.
 */
export const createPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; method: "pix" | "usdt" }) =>
    z.object({ planId: z.string().uuid(), method: z.enum(["pix", "usdt"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const provider = "connectpay";

    const { data: checkout, error: checkoutError } = await supabaseAdmin.rpc(
      "create_plan_checkout",
      { _user: context.userId, _plan: data.planId, _provider: provider },
    );
    if (checkoutError) throw new Error(checkoutError.message);
    const row = (Array.isArray(checkout) ? checkout[0] : checkout) as {
      payment_id: string;
      user_plan_id: string;
      price: number;
      plan_name: string;
    };
    if (!row?.payment_id) throw new Error("Não foi possível iniciar a compra do plano.");

    const price = Number(Number(row.price).toFixed(2));

    /** Cancela plano/pagamento pendentes quando a gateway falha. */
    const abort = async (message: string): Promise<never> => {
      await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", row.payment_id);
      await supabaseAdmin
        .from("user_plans")
        .update({ status: "cancelled" })
        .eq("id", row.user_plan_id);
      await supabaseAdmin
        .from("payment_events")
        .insert({ payment_id: row.payment_id, event_type: "gateway_error", payload: { message } });
      throw new Error(message);
    };

    const depositId = crypto.randomUUID();

    if (data.method === "pix") {
      const cp = await import("./connectpay.server");
      let gateway: Awaited<ReturnType<typeof cp.loadGateway>>;
      let secret: string;
      try {
        const active = await cp.requireActiveGateway(supabaseAdmin, "pix_cashin");
        gateway = active.gateway;
        secret = active.secret;
      } catch {
        return abort("Pagamento via PIX temporariamente indisponível.");
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email, phone, cpf")
        .eq("id", context.userId)
        .maybeSingle();
      const document = (profile?.cpf ?? "").replace(/\D/g, "");
      const phone = (profile?.phone ?? "").replace(/\D/g, "");
      if (!profile?.full_name || !profile.email || document.length < 11 || phone.length < 10) {
        return abort(
          "Complete seu perfil (nome, e-mail, WhatsApp e CPF) em Minha conta antes de pagar.",
        );
      }

      const { error: depError } = await supabaseAdmin.from("deposits").insert({
        id: depositId,
        user_id: context.userId,
        method: "pix",
        currency: "BRL",
        amount: price,
        brl_amount: price,
        conversion_rate: 1,
        payment_purpose: "plan_purchase",
        payment_id: row.payment_id,
        plan_id: data.planId,
        external_id: depositId,
        idempotency_key: `connectpay-plan-${depositId}`,
        status: "pending",
        provider: cp.PROVIDER,
      });
      if (depError) return abort("Não foi possível registrar a cobrança do plano.");

      try {
        const response = await cp.createPixTransaction(secret, gateway!.base_url, {
          external_id: depositId,
          total_amount: price,
          payment_method: "PIX",
          webhook_url: cp.webhookUrls(gateway).pixCashIn,
          ip: await cp.clientIp(),
          items: [
            {
              id: depositId,
              title: `Plano ${row.plan_name} — Arena Saúde`,
              description: `Plano ${row.plan_name} — Arena Saúde`,
              price,
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
            expires_at: response.pix?.expires_at ?? null,
            metadata: { provider_status: response.status ?? null, purpose: "plan_purchase" },
          })
          .eq("id", depositId);

        return {
          depositId,
          paymentId: row.payment_id,
          method: "pix" as const,
          priceBrl: price,
          usdtAmount: null,
          rate: 1,
        };
      } catch (err) {
        const message =
          err instanceof cp.GatewayError
            ? err.message
            : "Não foi possível gerar o PIX neste momento.";
        await supabaseAdmin
          .from("deposits")
          .update({ status: "failed", failure_reason: message })
          .eq("id", depositId);
        return abort(message);
      }
    }

    /* ---------------------------- USDT BEP20 ---------------------------- */
    const cp = await import("./connectpay.server");
    const { currentUsdtRate, toUsdt } = await import("./usdt.server");

    let gateway: Awaited<ReturnType<typeof cp.loadGateway>>;
    let secret: string;
    try {
      const active = await cp.requireActiveGateway(supabaseAdmin, "usdt_deposit");
      gateway = active.gateway;
      secret = active.secret;
    } catch {
      return abort("Pagamento via USDT temporariamente indisponível.");
    }

    const rate = await currentUsdtRate(supabaseAdmin);
    const usdtAmount = toUsdt(price, rate);
    if (usdtAmount <= 0) return abort("Valor convertido em USDT inválido.");

    const idempotencyKey = `connectpay-usdt-deposit-${depositId}`;

    const { error: depError } = await supabaseAdmin.from("deposits").insert({
      id: depositId,
      user_id: context.userId,
      method: "crypto",
      currency: "USDT",
      network: cp.USDT_CHAIN,
      amount: usdtAmount,
      expected_amount: usdtAmount,
      crypto_amount: usdtAmount,
      conversion_rate: rate,
      brl_amount: price,
      payment_purpose: "plan_purchase",
      payment_id: row.payment_id,
      plan_id: data.planId,
      external_id: depositId,
      order_id: depositId,
      idempotency_key: idempotencyKey,
      status: "creating",
      provider: cp.PROVIDER,
    });
    if (depError) return abort("Não foi possível registrar a cobrança do plano.");

    try {
      const response = await cp.createCryptoDeposit(
        secret,
        gateway!.base_url,
        {
          asset: cp.USDT_ASSET,
          chain: cp.USDT_CHAIN,
          amount: usdtAmount.toFixed(6),
          webhook_url: cp.webhookUrls(gateway).crypto,
        },
        idempotencyKey,
      );

      const address = response.deposit_address ? String(response.deposit_address) : null;
      const transactionId = String(response.transaction_id ?? response.id ?? "") || null;
      if (!address) {
        throw new cp.GatewayError("A ConnectPay não retornou o endereço de depósito.", 502);
      }

      await supabaseAdmin
        .from("deposits")
        .update({
          provider_transaction_id: transactionId,
          deposit_address: address,
          pay_address: address,
          qr_code: response.qr_code ? String(response.qr_code) : null,
          gateway_fee: response.fee === undefined ? 0 : Number(response.fee),
          net_amount: response.net_amount === undefined ? null : Number(response.net_amount),
          expected_amount: response.amount === undefined ? usdtAmount : Number(response.amount),
          payment_status: String(response.status ?? "PENDING_CONFIRMATION").toLowerCase(),
          status: "pending",
          expires_at: response.expires_at ?? null,
          metadata: {
            provider: cp.PROVIDER,
            purpose: "plan_purchase",
            asset: cp.USDT_ASSET,
            chain: cp.USDT_CHAIN,
            conversion_rate: rate,
            brl_amount: price,
          } as never,
        })
        .eq("id", depositId);

      return {
        depositId,
        paymentId: row.payment_id,
        method: "usdt" as const,
        priceBrl: price,
        usdtAmount,
        rate,
      };
    } catch (err) {
      const message =
        err instanceof cp.GatewayError
          ? err.message
          : "Não foi possível gerar a cobrança em USDT neste momento.";
      await supabaseAdmin
        .from("deposits")
        .update({ status: "failed", failure_reason: message })
        .eq("id", depositId);
      return abort(message);
    }
  });
