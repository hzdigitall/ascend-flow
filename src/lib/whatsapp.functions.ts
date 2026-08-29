import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

/** Painel admin — estado atual da automação de WhatsApp (PlugSend). */
export const getWhatsappSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadWhatsappConfig } = await import("./whatsapp.server");
    const config = await loadWhatsappConfig(supabaseAdmin);
    return {
      enabled: config?.enabled ?? false,
      notify_deposit: config?.notify_deposit ?? true,
      notify_withdrawal: config?.notify_withdrawal ?? true,
      notify_referral: config?.notify_referral ?? true,
      notify_commission: config?.notify_commission ?? true,
      tokenConfigured: Boolean(config?.token_ciphertext),
      masked: config?.token_last_four ? `••••••••••••${config.token_last_four}` : null,
    };
  });

/** Salva (cifrado) o token da API PlugSend. */
export const saveWhatsappToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(8).max(512) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./gateway-vault.server");

    const { ciphertext, iv } = await encryptSecret(data.token);
    const { error } = await supabaseAdmin
      .from("whatsapp_settings")
      .update({
        token_ciphertext: ciphertext,
        token_iv: iv,
        token_last_four: data.token.slice(-4),
        updated_by: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error("Não foi possível salvar o token com segurança.");

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "whatsapp_token_saved",
      table_name: "whatsapp_settings",
      new_value: { last_four: data.token.slice(-4) } as never,
    });
    return { ok: true as const, message: "✅ Token PlugSend salvo com segurança." };
  });

/** Liga/desliga a automação geral e cada tipo de mensagem. */
export const setWhatsappFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      enabled?: boolean;
      notify_deposit?: boolean;
      notify_withdrawal?: boolean;
      notify_referral?: boolean;
      notify_commission?: boolean;
    }) =>
      z
        .object({
          enabled: z.boolean().optional(),
          notify_deposit: z.boolean().optional(),
          notify_withdrawal: z.boolean().optional(),
          notify_referral: z.boolean().optional(),
          notify_commission: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadWhatsappConfig } = await import("./whatsapp.server");

    if (data.enabled === true) {
      const config = await loadWhatsappConfig(supabaseAdmin);
      if (!config?.token_ciphertext) {
        throw new Error("Cadastre o token da PlugSend antes de ativar a automação.");
      }
    }

    const patch: Record<string, boolean | string> = { updated_by: context.userId };
    for (const key of [
      "enabled",
      "notify_deposit",
      "notify_withdrawal",
      "notify_referral",
      "notify_commission",
    ] as const) {
      const value = data[key];
      if (value !== undefined) patch[key] = value;
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_settings")
      .update(patch as never)
      .eq("id", true);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "whatsapp_settings_updated",
      table_name: "whatsapp_settings",
      new_value: data as never,
    });
    return { ok: true as const };
  });

/** Envio de teste para um número informado pelo admin. */
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string; message?: string }) =>
    z
      .object({ phone: z.string().trim().min(8).max(20), message: z.string().max(500).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadWhatsappToken, normalizePhone, sendWhatsappText } = await import(
      "./whatsapp.server"
    );

    const token = await loadWhatsappToken(supabaseAdmin);
    if (!token) return { ok: false as const, message: "Cadastre o token da PlugSend primeiro." };

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, message: "Número inválido. Use DDD + número." };

    const result = await sendWhatsappText(
      token,
      phone,
      data.message?.trim() || "Mensagem de teste da Arena Saúde ✅",
    );
    return result.success
      ? { ok: true as const, message: "✅ Mensagem de teste enviada." }
      : { ok: false as const, message: `❌ Falha no envio (HTTP ${result.status}).` };
  });

/** Chamado logo após o cadastro: avisa o patrocinador sobre a nova indicação. */
export const notifyMySignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyReferralRegistered } = await import("./whatsapp.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) return { ok: false as const };
    if (Date.now() - new Date(profile.created_at).getTime() > 15 * 60_000) {
      return { ok: false as const };
    }

    // E-mail de boas-vindas — enviado uma única vez por usuário.
    try {
      const { data: emailSent } = await supabaseAdmin
        .from("admin_logs")
        .select("id")
        .eq("action", "welcome_email_sent")
        .eq("record_id", context.userId)
        .maybeSingle();
      if (!emailSent) {
        await supabaseAdmin.from("admin_logs").insert({
          action: "welcome_email_sent",
          table_name: "profiles",
          record_id: context.userId,
        });
        const { data: info } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", context.userId)
          .maybeSingle();
        if (info?.email) {
          const { sendTemplateEmail } = await import("./email-templates/send-email");
          await sendTemplateEmail("welcome", info.email, {
            templateData: {
              name: info.full_name || undefined,
              url: "https://www.arenasuplementos.com/dashboard",
            },
            idempotencyKey: `welcome-${context.userId}`,
          });
        }
      }
    } catch {
      // e-mail de boas-vindas é opcional: nunca bloqueia o cadastro
    }

    const { data: already } = await supabaseAdmin
      .from("admin_logs")
      .select("id")
      .eq("action", "whatsapp_referral_notified")
      .eq("record_id", context.userId)
      .maybeSingle();
    if (already) return { ok: false as const };

    await supabaseAdmin.from("admin_logs").insert({
      action: "whatsapp_referral_notified",
      table_name: "profiles",
      record_id: context.userId,
    });
    await notifyReferralRegistered(supabaseAdmin, context.userId);
    return { ok: true as const };
  });
