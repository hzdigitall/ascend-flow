import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_TTL_MINUTES = 15;

async function hashCode(code: string, userId: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/** Envia um código de confirmação para o novo e-mail informado pelo usuário. */
export const requestEmailChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { newEmail: string }) =>
    z
      .object({ newEmail: z.string().trim().toLowerCase().email().max(255) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.email?.toLowerCase() === data.newEmail) {
      throw new Error("Este já é o e-mail da sua conta.");
    }

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.newEmail)
      .maybeSingle();
    if (taken) throw new Error("Este e-mail já está em uso por outra conta.");

    // Limite simples: no máximo 3 pedidos por hora.
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("email_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 3) {
      throw new Error("Muitas solicitações. Tente novamente mais tarde.");
    }

    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const code = String(100000 + ((bytes[0] ?? 0) % 900000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

    // Invalida pedidos anteriores em aberto.
    await supabaseAdmin
      .from("email_change_requests")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("used_at", null);

    const { data: inserted, error } = await supabaseAdmin
      .from("email_change_requests")
      .insert({
        user_id: context.userId,
        new_email: data.newEmail,
        code_hash: await hashCode(code, context.userId),
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("email-change-code", data.newEmail, {
        templateData: {
          name: profile?.full_name ?? "",
          code,
          minutes: CODE_TTL_MINUTES,
        },
      });
    } catch (err) {
      // Falha no envio: encerra a solicitação para não deixar pedido pendente sem código.
      if (inserted?.id) {
        await supabaseAdmin
          .from("email_change_requests")
          .update({ used_at: new Date().toISOString() })
          .eq("id", inserted.id);
      }
      throw new Error("Não foi possível enviar o código. Tente novamente em instantes.");
    }


    return { ok: true, newEmail: data.newEmail, expiresAt };
  });

/** Confirma o código e efetiva a troca de e-mail de login. */
export const confirmEmailChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) =>
    z.object({ code: z.string().trim().regex(/^\d{6}$/, "Código inválido") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabaseAdmin
      .from("email_change_requests")
      .select("id, new_email, code_hash, attempts, expires_at")
      .eq("user_id", context.userId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!request) throw new Error("Nenhuma solicitação de troca de e-mail em aberto.");
    if (new Date(request.expires_at).getTime() < Date.now()) {
      throw new Error("O código expirou. Solicite um novo.");
    }
    if (request.attempts >= 5) {
      throw new Error("Muitas tentativas. Solicite um novo código.");
    }

    const expected = await hashCode(data.code, context.userId);
    if (expected !== request.code_hash) {
      await supabaseAdmin
        .from("email_change_requests")
        .update({ attempts: request.attempts + 1 })
        .eq("id", request.id);
      throw new Error("Código incorreto.");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email: request.new_email,
      email_confirm: true,
    });
    if (authError) throw new Error(authError.message);

    await supabaseAdmin
      .from("profiles")
      .update({ email: request.new_email })
      .eq("id", context.userId);

    await supabaseAdmin
      .from("email_change_requests")
      .update({ used_at: new Date().toISOString() })
      .eq("id", request.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      title: "E-mail alterado",
      body: `O e-mail de acesso da sua conta agora é ${request.new_email}.`,
      type: "account",
    });

    return { ok: true, newEmail: request.new_email };
  });
