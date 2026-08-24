import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

/**
 * Funções administrativas da gateway ConnectPay.
 * Todas validam a role de administrador no servidor.
 * O API Secret nunca é retornado ao frontend (apenas os 4 últimos dígitos).
 */

export const getGatewayOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadGateway, webhookUrls } = await import("./connectpay.server");
    const { maskSecret } = await import("./gateway-vault.server");
    const gateway = await loadGateway(supabaseAdmin);
    return {
      gateway,
      masked: gateway?.credential_last_four ? maskSecret(gateway.credential_last_four) : null,
      webhooks: webhookUrls(gateway),
    };
  });

export const saveGatewayCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { apiSecret: string }) =>
    z.object({ apiSecret: z.string().trim().min(8).max(512) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./gateway-vault.server");
    const cp = await import("./connectpay.server");

    const gateway = await cp.loadGateway(supabaseAdmin);
    const baseUrl = gateway?.base_url ?? cp.DEFAULT_BASE_URL;

    // 1) Testa a NOVA chave antes de substituir a anterior.
    try {
      await cp.getAccountInfo(data.apiSecret, baseUrl);
    } catch (err) {
      const status = err instanceof cp.GatewayError ? err.status : 500;
      await supabaseAdmin
        .from("payment_gateways")
        .update({
          last_connection_test: new Date().toISOString(),
          last_error: cp.friendlyMessage(status),
        })
        .eq("provider", cp.PROVIDER);
      return {
        ok: false as const,
        message:
          status === 401
            ? "❌ API Secret inválido ou não autorizado."
            : `❌ ${cp.friendlyMessage(status)}`,
      };
    }

    // 2) Só agora cifra e substitui.
    const lastFour = data.apiSecret.slice(-4);
    const { ciphertext, iv } = await encryptSecret(data.apiSecret);
    const { error } = await supabaseAdmin.from("gateway_credentials").upsert(
      {
        provider: cp.PROVIDER,
        ciphertext,
        iv,
        last_four: lastFour,
        updated_by: context.userId,
      },
      { onConflict: "provider" },
    );
    if (error) throw new Error("Não foi possível salvar a credencial com segurança.");

    await supabaseAdmin
      .from("payment_gateways")
      .update({
        credentials_configured: true,
        credential_last_four: lastFour,
        connection_status: "connected",
        last_connection_test: new Date().toISOString(),
        last_error: null,
      })
      .eq("provider", cp.PROVIDER);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "gateway_credential_saved",
      table_name: "payment_gateways",
      new_value: { provider: cp.PROVIDER, last_four: lastFour },
    });

    return { ok: true as const, message: "✅ ConnectPay conectada com sucesso" };
  });

export const testGatewayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");

    const gateway = await cp.loadGateway(supabaseAdmin);
    if (!gateway?.credentials_configured) {
      return { ok: false as const, message: "Cadastre o API Secret antes de testar a conexão." };
    }

    try {
      const secret = await cp.loadSecret(supabaseAdmin);
      await cp.getAccountInfo(secret, gateway.base_url);
      await supabaseAdmin
        .from("payment_gateways")
        .update({
          connection_status: "connected",
          last_connection_test: new Date().toISOString(),
          last_error: null,
        })
        .eq("provider", cp.PROVIDER);
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "gateway_connection_tested",
        table_name: "payment_gateways",
        new_value: { result: "connected" },
      });
      return { ok: true as const, message: "✅ ConnectPay conectada com sucesso" };
    } catch (err) {
      const status = err instanceof cp.GatewayError ? err.status : 500;
      const message =
        status === 401
          ? "❌ API Secret inválido ou não autorizado."
          : `❌ ${cp.friendlyMessage(status)}`;
      await supabaseAdmin
        .from("payment_gateways")
        .update({
          connection_status: status === 401 ? "unauthorized" : "error",
          last_connection_test: new Date().toISOString(),
          last_error: message,
        })
        .eq("provider", cp.PROVIDER);
      return { ok: false as const, message };
    }
  });

export const setGatewayActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { active: boolean }) =>
    z.object({ active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cp = await import("./connectpay.server");
    const gateway = await cp.loadGateway(supabaseAdmin);

    if (data.active) {
      if (!gateway?.credentials_configured || gateway.connection_status !== "connected") {
        throw new Error(
          "Para ativar é necessário cadastrar o API Secret e obter uma conexão bem-sucedida.",
        );
      }
    }

    await supabaseAdmin
      .from("payment_gateways")
      .update({ active: data.active })
      .eq("provider", cp.PROVIDER);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.active ? "gateway_activated" : "gateway_deactivated",
      table_name: "payment_gateways",
      new_value: { provider: cp.PROVIDER },
    });
    return { ok: true, active: data.active };
  });

export const setGatewayFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      pix_cashin_enabled?: boolean;
      pix_cashout_enabled?: boolean;
      usdt_deposit_enabled?: boolean;
      usdt_withdraw_enabled?: boolean;
      webhook_base_url?: string;
    }) =>
      z
        .object({
          pix_cashin_enabled: z.boolean().optional(),
          pix_cashout_enabled: z.boolean().optional(),
          usdt_deposit_enabled: z.boolean().optional(),
          usdt_withdraw_enabled: z.boolean().optional(),
          webhook_base_url: z.string().url().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PROVIDER } = await import("./connectpay.server");
    const patch: {
      pix_cashin_enabled?: boolean;
      pix_cashout_enabled?: boolean;
      usdt_deposit_enabled?: boolean;
      usdt_withdraw_enabled?: boolean;
      webhook_base_url?: string;
    } = {};
    if (data.pix_cashin_enabled !== undefined) patch.pix_cashin_enabled = data.pix_cashin_enabled;
    if (data.pix_cashout_enabled !== undefined)
      patch.pix_cashout_enabled = data.pix_cashout_enabled;
    if (data.usdt_deposit_enabled !== undefined)
      patch.usdt_deposit_enabled = data.usdt_deposit_enabled;
    if (data.usdt_withdraw_enabled !== undefined)
      patch.usdt_withdraw_enabled = data.usdt_withdraw_enabled;
    if (data.webhook_base_url !== undefined) patch.webhook_base_url = data.webhook_base_url;

    const { error } = await supabaseAdmin
      .from("payment_gateways")
      .update(patch)
      .eq("provider", PROVIDER);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "gateway_features_updated",
      table_name: "payment_gateways",
      new_value: data,
    });
    return { ok: true };
  });
