import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

/**
 * Administração da gateway NOWPayments (USDT BEP20 / ticker USDTBSC).
 * Nenhuma credencial real é devolvida ao navegador — apenas máscaras.
 */

const SECRET_KEYS = ["api_key", "ipn_secret", "email", "password", "totp_secret"] as const;

export const getNowPaymentsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");

    const gateway = await np.loadGateway(supabaseAdmin);
    const { data: rows } = await supabaseAdmin
      .from("gateway_secrets")
      .select("key_name, last_four, updated_at")
      .eq("provider", np.PROVIDER);

    const configured: Record<string, { masked: string; updatedAt: string } | null> = {};
    for (const key of SECRET_KEYS) {
      const row = rows?.find((r) => r.key_name === key);
      configured[key] = row
        ? {
            masked: row.last_four ? `••••••••••••${row.last_four}` : "••••••••••••",
            updatedAt: row.updated_at,
          }
        : null;
    }

    return {
      gateway,
      configured,
      ticker: np.PAY_CURRENCY_LABEL,
      network: np.NETWORK_LABEL,
      webhooks: np.webhookUrls(gateway),
      payoutReady: Boolean(
        gateway?.credentials_configured &&
          gateway.ipn_configured &&
          gateway.payout_auth_configured &&
          gateway.asset_available,
      ),
    };
  });

export const saveNowPaymentsCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      apiKey?: string;
      ipnSecret?: string;
      email?: string;
      password?: string;
      totpSecret?: string;
    }) =>
      z
        .object({
          apiKey: z.string().trim().min(8).max(512).optional(),
          ipnSecret: z.string().trim().min(8).max(512).optional(),
          email: z.string().trim().email().max(200).optional(),
          password: z.string().min(6).max(200).optional(),
          totpSecret: z.string().trim().min(8).max(200).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./gateway-vault.server");
    const np = await import("./nowpayments.server");

    const entries: Array<[np.SecretKey, string]> = [];
    if (data.apiKey) entries.push(["api_key", data.apiKey]);
    if (data.ipnSecret) entries.push(["ipn_secret", data.ipnSecret]);
    if (data.email) entries.push(["email", data.email]);
    if (data.password) entries.push(["password", data.password]);
    if (data.totpSecret) entries.push(["totp_secret", data.totpSecret.replace(/\s+/g, "")]);
    if (entries.length === 0) {
      return { ok: false as const, message: "Informe ao menos uma credencial para salvar." };
    }

    const gateway = await np.loadGateway(supabaseAdmin);
    const baseUrl = gateway?.base_url ?? np.DEFAULT_BASE_URL;

    // Valida a NOVA API Key antes de substituir a anterior.
    if (data.apiKey) {
      try {
        await np.getMerchantCoins(data.apiKey, baseUrl);
      } catch (err) {
        const status = err instanceof np.NowPaymentsError ? err.status : 500;
        await supabaseAdmin
          .from("payment_gateways")
          .update({
            connection_status: status === 401 || status === 403 ? "unauthorized" : "error",
            last_connection_test: new Date().toISOString(),
            last_error: np.friendlyMessage(status),
          })
          .eq("provider", np.PROVIDER);
        return {
          ok: false as const,
          message:
            status === 401 || status === 403
              ? "❌ API Key inválida ou não autorizada."
              : `❌ ${np.friendlyMessage(status)}`,
        };
      }
    }

    for (const [key, value] of entries) {
      const { ciphertext, iv } = await encryptSecret(value);
      const { error } = await supabaseAdmin.from("gateway_secrets").upsert(
        {
          provider: np.PROVIDER,
          key_name: key,
          ciphertext,
          iv,
          last_four: key === "password" || key === "totp_secret" ? "" : value.slice(-4),
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,key_name" },
      );
      if (error) throw new Error("Não foi possível salvar a credencial com segurança.");
    }

    const { data: rows } = await supabaseAdmin
      .from("gateway_secrets")
      .select("key_name, last_four")
      .eq("provider", np.PROVIDER);
    const has = (k: string) => Boolean(rows?.some((r) => r.key_name === k));

    const patch: Record<string, unknown> = {
      credentials_configured: has("api_key"),
      ipn_configured: has("ipn_secret"),
      payout_auth_configured: has("email") && has("password"),
      totp_configured: has("totp_secret"),
    };
    if (data.apiKey) {
      patch["credential_last_four"] = data.apiKey.slice(-4);
      patch["connection_status"] = "connected";
      patch["last_connection_test"] = new Date().toISOString();
      patch["last_error"] = null;
    }
    await supabaseAdmin.from("payment_gateways").update(patch).eq("provider", np.PROVIDER);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "nowpayments_credentials_saved",
      table_name: "payment_gateways",
      new_value: { keys: entries.map(([k]) => k) },
    });

    return { ok: true as const, message: "✅ Credenciais NOWPayments salvas com segurança." };
  });

export const testNowPaymentsConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");

    const gateway = await np.loadGateway(supabaseAdmin);
    const baseUrl = gateway?.base_url ?? np.DEFAULT_BASE_URL;

    // 1) Disponibilidade da API (não valida credencial).
    try {
      await np.getApiStatus(baseUrl);
    } catch {
      await supabaseAdmin
        .from("payment_gateways")
        .update({
          connection_status: "error",
          last_connection_test: new Date().toISOString(),
          last_error: "API da NOWPayments indisponível.",
        })
        .eq("provider", np.PROVIDER);
      return { ok: false as const, message: "❌ API da NOWPayments indisponível (/v1/status)." };
    }

    if (!gateway?.credentials_configured) {
      return {
        ok: false as const,
        message: "API online, mas a API Key ainda não foi configurada.",
      };
    }

    // 2) Validação real da credencial + disponibilidade do USDTBSC.
    try {
      const apiKey = await np.requireApiKey(supabaseAdmin);
      const coins = await np.getMerchantCoins(apiKey, baseUrl);
      const list = (coins.selectedCurrencies ?? []).map((c) => String(c).toLowerCase());
      const available = list.includes(np.PAY_CURRENCY);

      let balance: Record<string, unknown> = {};
      try {
        balance = (await np.getBalance(apiKey, baseUrl)) as Record<string, unknown>;
      } catch {
        balance = {};
      }

      await supabaseAdmin
        .from("payment_gateways")
        .update({
          connection_status: "connected",
          asset_available: available,
          balance_snapshot: balance as never,
          last_connection_test: new Date().toISOString(),
          last_error: available
            ? null
            : "USDTBSC não está habilitado/disponível nesta conta NOWPayments.",
          ...(available ? {} : { usdt_deposit_enabled: false, usdt_withdraw_enabled: false }),
        })
        .eq("provider", np.PROVIDER);

      return available
        ? { ok: true as const, message: "✅ NOWPayments conectada e USDTBSC disponível." }
        : {
            ok: false as const,
            message: "❌ USDTBSC não está habilitado/disponível nesta conta NOWPayments.",
          };
    } catch (err) {
      const status = err instanceof np.NowPaymentsError ? err.status : 500;
      const message =
        status === 401 || status === 403
          ? "❌ API Key inválida ou não autorizada."
          : `❌ ${np.friendlyMessage(status)}`;
      await supabaseAdmin
        .from("payment_gateways")
        .update({
          connection_status: status === 401 || status === 403 ? "unauthorized" : "error",
          last_connection_test: new Date().toISOString(),
          last_error: message,
        })
        .eq("provider", np.PROVIDER);
      return { ok: false as const, message };
    }
  });

export const refreshNowPaymentsBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");
    const gateway = await np.loadGateway(supabaseAdmin);
    if (!gateway?.credentials_configured) {
      return { ok: false as const, message: "Configure a API Key antes de consultar o saldo." };
    }
    try {
      const apiKey = await np.requireApiKey(supabaseAdmin);
      const balance = (await np.getBalance(apiKey, gateway.base_url)) as Record<string, unknown>;
      await supabaseAdmin
        .from("payment_gateways")
        .update({ balance_snapshot: balance as never })
        .eq("provider", np.PROVIDER);
      return { ok: true as const, message: "Saldo atualizado." };
    } catch (err) {
      const status = err instanceof np.NowPaymentsError ? err.status : 500;
      return { ok: false as const, message: np.friendlyMessage(status) };
    }
  });

export const setNowPaymentsActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { active: boolean }) => z.object({ active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");
    const gateway = await np.loadGateway(supabaseAdmin);

    if (data.active) {
      if (!gateway?.credentials_configured) throw new Error("Cadastre a API Key antes de ativar.");
      if (!gateway.ipn_configured) throw new Error("Cadastre o IPN Secret antes de ativar.");
      if (gateway.connection_status !== "connected") {
        throw new Error("Teste a conexão com sucesso antes de ativar.");
      }
      if (!gateway.asset_available) {
        throw new Error("USDTBSC não está habilitado/disponível nesta conta NOWPayments.");
      }
    }

    await supabaseAdmin
      .from("payment_gateways")
      .update({ active: data.active })
      .eq("provider", np.PROVIDER);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.active ? "nowpayments_activated" : "nowpayments_deactivated",
      table_name: "payment_gateways",
      new_value: { provider: np.PROVIDER },
    });
    return { ok: true, active: data.active };
  });

export const setNowPaymentsFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      usdt_deposit_enabled?: boolean;
      usdt_withdraw_enabled?: boolean;
      webhook_base_url?: string;
    }) =>
      z
        .object({
          usdt_deposit_enabled: z.boolean().optional(),
          usdt_withdraw_enabled: z.boolean().optional(),
          webhook_base_url: z.string().url().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");
    const gateway = await np.loadGateway(supabaseAdmin);

    const patch: Record<string, unknown> = {};
    if (data.usdt_deposit_enabled !== undefined) {
      if (data.usdt_deposit_enabled && !gateway?.asset_available) {
        throw new Error("USDTBSC não está habilitado/disponível nesta conta NOWPayments.");
      }
      patch["usdt_deposit_enabled"] = data.usdt_deposit_enabled;
    }
    if (data.usdt_withdraw_enabled !== undefined) {
      if (data.usdt_withdraw_enabled && !gateway?.payout_auth_configured) {
        throw new Error(
          "Configure e-mail e senha da conta NOWPayments (autenticação de payout) antes de habilitar saques.",
        );
      }
      patch["usdt_withdraw_enabled"] = data.usdt_withdraw_enabled;
    }
    if (data.webhook_base_url !== undefined) patch["webhook_base_url"] = data.webhook_base_url;

    const { error } = await supabaseAdmin
      .from("payment_gateways")
      .update(patch)
      .eq("provider", np.PROVIDER);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "nowpayments_features_updated",
      table_name: "payment_gateways",
      new_value: data,
    });
    return { ok: true };
  });

/** Reconciliação manual de depósito: consulta GET /v1/payment/:id (nunca cria). */
export const adminReconcileNowPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { depositId: string }) =>
    z.object({ depositId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const np = await import("./nowpayments.server");
    const { settleNowPayment } = await import("./nowpayments-settle.server");

    const { data: deposit } = await supabaseAdmin
      .from("deposits")
      .select("id, provider, provider_transaction_id, credited_at")
      .eq("id", data.depositId)
      .maybeSingle();
    if (!deposit) throw new Error("Depósito não encontrado.");
    if (deposit.provider !== np.PROVIDER) {
      return { ok: false as const, message: "Este depósito não pertence à NOWPayments." };
    }
    if (!deposit.provider_transaction_id) {
      return { ok: false as const, message: "Depósito sem payment_id na NOWPayments." };
    }

    const gateway = await np.loadGateway(supabaseAdmin);
    const apiKey = await np.requireApiKey(supabaseAdmin);
    const payment = await np.getPayment(apiKey, gateway?.base_url, deposit.provider_transaction_id);
    const result = await settleNowPayment(supabaseAdmin, payment, "admin_reconcile");
    return {
      ok: true as const,
      message: `Status NOWPayments: ${String(payment.payment_status ?? "desconhecido")} — ${result.reason}`,
    };
  });
