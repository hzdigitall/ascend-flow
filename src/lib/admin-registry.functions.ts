import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

/** Busca paginada de registros (usuários) para o painel administrativo. */
export const adminListRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string; page?: number; pageSize?: number }) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        page: z.number().int().min(0).max(10_000).default(0),
        pageSize: z.number().int().min(5).max(100).default(25),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, cpf, referral_code, blocked, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    const term = data.search?.replace(/[%,]/g, "");
    if (term) {
      query = query.or(
        `email.ilike.%${term}%,full_name.ilike.%${term}%,cpf.ilike.%${term}%,referral_code.ilike.%${term}%`,
      );
    }

    const from = data.page * data.pageSize;
    const { data: rows, count, error } = await query.range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);

    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

/** Detalhe de um registro: patrocinador e indicados por nível. */
export const adminRegistryDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, cpf, referral_code, blocked, sponsor_id, created_at")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Usuário não encontrado.");

    let sponsor: { full_name: string; email: string } | null = null;
    if (profile.sponsor_id) {
      const { data: s } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", profile.sponsor_id)
        .maybeSingle();
      sponsor = s ?? null;
    }

    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("level, referred_id, created_at")
      .eq("sponsor_id", data.userId)
      .order("level", { ascending: true })
      .limit(2000);

    const ids = [...new Set((refs ?? []).map((r) => r.referred_id))];
    const people = new Map<string, { full_name: string; email: string; created_at: string }>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, created_at")
        .in("id", ids);
      (profiles ?? []).forEach((p) =>
        people.set(p.id, { full_name: p.full_name, email: p.email, created_at: p.created_at }),
      );
    }

    const levels = Array.from({ length: 8 }, (_, i) => ({
      level: i + 1,
      members: (refs ?? [])
        .filter((r) => r.level === i + 1)
        .map((r) => ({
          id: r.referred_id,
          full_name: people.get(r.referred_id)?.full_name ?? "—",
          email: people.get(r.referred_id)?.email ?? "—",
          created_at: people.get(r.referred_id)?.created_at ?? r.created_at,
        })),
    }));

    return { profile, sponsor, levels, total: refs?.length ?? 0 };
  });

/** Altera nome, e-mail e/ou senha de um usuário. */
export const adminUpdateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; fullName?: string; email?: string; password?: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().min(3).max(120).optional(),
        email: z.string().trim().toLowerCase().email().max(255).optional(),
        password: z.string().min(8).max(72).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.email) {
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", data.email)
        .neq("id", data.userId)
        .maybeSingle();
      if (taken) throw new Error("Este e-mail já está em uso por outra conta.");
    }

    if (data.email || data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ...(data.email ? { email: data.email, email_confirm: true } : {}),
        ...(data.password ? { password: data.password } : {}),
      });
      if (error) throw new Error(error.message);
    }

    if (data.fullName || data.email) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          ...(data.fullName ? { full_name: data.fullName } : {}),
          ...(data.email ? { email: data.email } : {}),
        })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "account_updated",
      table_name: "profiles",
      record_id: data.userId,
      new_value: {
        full_name: data.fullName ?? null,
        email: data.email ?? null,
        password_changed: Boolean(data.password),
      },
    });

    return { ok: true };
  });
