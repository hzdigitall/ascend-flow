import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";


export const adminConfirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { paymentId: string; note?: string }) =>
    z.object({ paymentId: z.string().uuid(), note: z.string().max(300).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("confirm_payment", {
      _payment: data.paymentId,
      _payload: { source: "admin", admin_id: context.userId, note: data.note ?? null },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "payment_confirmed_manually",
      table_name: "payments",
      record_id: data.paymentId,
      new_value: { note: data.note ?? null },
    });
    const { notifyCommissionsForPayment } = await import("./whatsapp.server");
    await notifyCommissionsForPayment(supabaseAdmin, data.paymentId);
    return { ok: true };
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withdrawalId: string; action: string; reason?: string }) =>
    z
      .object({
        withdrawalId: z.string().uuid(),
        action: z.enum(["approve", "pay", "reject"]),
        reason: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("process_withdrawal", {
      _admin: context.userId,
      _wid: data.withdrawalId,
      _action: data.action,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    const { notifyWithdrawalStatus } = await import("./whatsapp.server");
    await notifyWithdrawalStatus(supabaseAdmin, data.withdrawalId);
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; blocked?: boolean; makeAdmin?: boolean; sponsorBadge?: boolean }) =>
    z
      .object({
        userId: z.string().uuid(),
        blocked: z.boolean().optional(),
        makeAdmin: z.boolean().optional(),
        sponsorBadge: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (typeof data.blocked === "boolean") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ blocked: data.blocked })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (typeof data.sponsorBadge === "boolean") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ sponsor_badge: data.sponsorBadge })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (typeof data.makeAdmin === "boolean") {
      if (data.makeAdmin) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
      }
    }
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "user_updated",
      table_name: "profiles",
      record_id: data.userId,
      new_value: {
        blocked: data.blocked ?? null,
        admin: data.makeAdmin ?? null,
        sponsor_badge: data.sponsorBadge ?? null,
      },
    });
    return { ok: true };
  });


export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; redirectTo: string }) =>
    z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "password_reset_sent",
      table_name: "auth.users",
      new_value: { email: data.email },
    });
    return { ok: true };
  });

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; status: string; trackingCode?: string }) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["placed", "preparing", "shipped", "delivered", "cancelled"]),
        trackingCode: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status, tracking_code: data.trackingCode ?? null })
      .eq("id", data.orderId)
      .select("user_id, order_number")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: order.user_id,
      title: "Pedido atualizado",
      body: `O pedido ${order.order_number} está com status: ${data.status}.`,
      type: "order",
    });
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "order_updated",
      table_name: "orders",
      record_id: data.orderId,
      new_value: { status: data.status, tracking: data.trackingCode ?? null },
    });
    return { ok: true };
  });

export const adminAdjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; points: number; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        points: z.number().int().min(-1_000_000).max(1_000_000),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("credit_points", {
      _user: data.userId,
      _points: data.points,
      _cat: "adjustment",
      _desc: data.reason,
      _ref: null as unknown as string,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "points_adjusted",
      table_name: "wallets",
      record_id: data.userId,
      new_value: { points: data.points, reason: data.reason },
    });
    return { ok: true };
  });

export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days: number }) =>
    z.object({ days: z.number().int().min(1).max(3650) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [users, activeUsers, plansSold, paidPayments, pendingWd, pendingOrders, commissions, points, recentUsers] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("user_plans")
          .select("user_id", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("user_plans")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("created_at", since),
        supabaseAdmin.from("payments").select("amount, created_at, gateway").eq("status", "paid").gte("created_at", since),
        supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).in("status", ["pending", "reviewing", "processing"]),
        supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).in("status", ["placed", "preparing"]),
        supabaseAdmin.from("commissions").select("amount").gte("created_at", since),
        supabaseAdmin.from("points_transactions").select("points").eq("direction", "in").gte("created_at", since),
        supabaseAdmin.from("profiles").select("created_at").gte("created_at", since),
      ]);

    const sum = (rows: { amount?: number | string; points?: number | string }[] | null, key: "amount" | "points") =>
      (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

    // Planos liberados manualmente pelo admin não são receita: ficam separados.
    const allPaid = paidPayments.data ?? [];
    const realPayments = allPaid.filter((r) => r.gateway !== "admin");
    const manualPayments = allPaid.filter((r) => r.gateway === "admin");

    const byDay = new Map<string, { day: string; users: number; volume: number }>();
    const bucket = (iso: string) => {
      const day = iso.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, users: 0, volume: 0 });
      return byDay.get(day)!;
    };
    (recentUsers.data ?? []).forEach((r) => (bucket(r.created_at).users += 1));
    realPayments.forEach((r) => (bucket(r.created_at).volume += Number(r.amount)));


    return {
      totalUsers: users.count ?? 0,
      activeUsers: activeUsers.count ?? 0,
      plansSold: plansSold.count ?? 0,
      paymentVolume: sum(paidPayments.data, "amount"),
      pendingWithdrawals: pendingWd.count ?? 0,
      pendingOrders: pendingOrders.count ?? 0,
      commissionsTotal: sum(commissions.data, "amount"),
      pointsIssued: sum(points.data, "points"),
      series: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; wallet: string; amount: number; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        wallet: z.enum(["main", "earnings", "referral", "usdt"]),
        amount: z.number().refine((v) => v !== 0, "Informe um valor diferente de zero"),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_adjust_balance", {
      _admin: context.userId,
      _user: data.userId,
      _wallet: data.wallet,
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGrantPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; planId: string; reason?: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        planId: z.string().uuid(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_grant_plan", {
      _admin: context.userId,
      _user: data.userId,
      _plan: data.planId,
      _reason: data.reason ?? "Liberação manual",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_delete_user_data", {
      _admin: context.userId,
      _user: data.userId,
    });
    if (error) throw new Error(error.message);
    const del = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });
