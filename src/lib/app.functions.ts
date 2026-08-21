import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string }) =>
    z.object({ planId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixCharge, isPixGatewayConfigured } = await import("./pix.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, cpf")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: activePlans } = await supabaseAdmin
      .from("user_plans")
      .select("plan_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .eq("plan_id", data.planId);

    if ((activePlans?.length ?? 0) >= 4) {
      throw new Error("Você atingiu o limite máximo de 4 planos ativos deste mesmo tipo.");
    }

    const { data: paymentId, error } = await supabaseAdmin.rpc("create_plan_payment", {
      _user: context.userId,
      _plan: data.planId,
    });
    if (error) throw new Error(error.message);

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId as string)
      .single();
    if (payErr) throw new Error(payErr.message);

    if (!isPixGatewayConfigured()) {
      return {
        paymentId: payment.id,
        gatewayConfigured: false,
        message:
          "O gateway PIX ainda não foi configurado pelo administrador. A cobrança ficou registrada como pendente.",
      };
    }

    try {
      const minutes = Math.max(
        5,
        Math.round(
          (new Date(payment.expires_at ?? Date.now() + 1_800_000).getTime() - Date.now()) / 60_000,
        ),
      );
      const charge = await createPixCharge({
        paymentId: payment.id,
        amount: Number(payment.amount),
        description: `Plano ${payment.plan_id ?? ""}`,
        payerName: profile?.full_name ?? "",
        payerEmail: profile?.email ?? "",
        payerDocument: profile?.cpf ?? null,
        expiresInMinutes: minutes,
        webhookUrl: `${process.env["APP_URL"] ?? ""}/api/public/webhooks/pix`,
      });

      await supabaseAdmin
        .from("payments")
        .update({
          external_id: charge.externalId,
          pix_copy_paste: charge.copyPaste,
          pix_qr_code: charge.qrCodeImage,
          expires_at: charge.expiresAt,
        })
        .eq("id", payment.id);

      return { paymentId: payment.id, gatewayConfigured: true, message: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao gerar cobrança PIX";
      await supabaseAdmin
        .from("payment_events")
        .insert({ payment_id: payment.id, event_type: "gateway_error", payload: { message } });
      return { paymentId: payment.id, gatewayConfigured: false, message };
    }
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { wallet: string; amount: number; keyType: string; key: string }) =>
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
    const now = new Date();
    const day = now.getDay(); // 0=domingo, 1=segunda, 2=terça...
    const hour = now.getHours();

    // Regra: Rendimentos (earnings) -> Segundas, 10h às 17h
    if (data.wallet === "earnings") {
      const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const day = nowBR.getDay(); // 0=domingo, 1=segunda, 2=terça...
      const hour = nowBR.getHours();

      if (day !== 1) {
        throw new Error("Saques de rendimentos são permitidos apenas às segundas-feiras.");
      }
      if (hour < 10 || hour >= 17) {
        throw new Error("Saques de rendimentos são permitidos apenas entre 10h e 17h.");
      }
    }

    // Regra: Bônus/Indicação (referral) -> Todos os dias, 09h às 17h
    if (data.wallet === "referral") {
      if (hour < 9 || hour >= 17) {
        throw new Error("Saques de bônus são permitidos apenas entre 09h e 17h.");
      }
    }

    if (data.amount < 10) {
      throw new Error("O valor mínimo para saque é R$ 10,00.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("request_withdrawal", {
      _user: context.userId,
      _wallet: data.wallet,
      _amount: data.amount,
      _key_type: data.keyType,
      _key: data.key,
    });
    if (error) throw new Error(error.message);
    return { withdrawalId: id as string };
  });

export const redeemProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { productId: string; address: Record<string, string> }) =>
      z
        .object({
          productId: z.string().uuid(),
          address: z.object({
            name: z.string().trim().min(3).max(120),
            zip: z.string().trim().min(8, "CEP inválido").max(9),
            street: z.string().trim().min(3).max(160),
            number: z.string().trim().min(1).max(20),
            complement: z.string().trim().max(80).optional().default(""),
            district: z.string().trim().min(2).max(80),
            city: z.string().trim().min(2).max(80),
            state: z.string().trim().length(2, "UF deve ter 2 caracteres"),
          }),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("redeem_product", {
      _user: context.userId,
      _product: data.productId,
      _addr: data.address,
    });
    if (error) throw new Error(error.message);
    return { orderId: id as string };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador nesta plataforma.");

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "claim_first_admin",
      table_name: "user_roles",
    });
    return { ok: true };
  });
