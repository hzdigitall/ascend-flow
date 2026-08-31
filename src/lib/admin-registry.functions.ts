import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

type LookupRow = {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  sponsor_id?: string | null;
};

/** Busca um usuário por e-mail exato ou código de indicação, sem depender de filtros `or` (evita quebra com caracteres especiais). */
async function findUserByEmailOrCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  raw: string,
): Promise<LookupRow> {
  const term = raw.trim();
  if (!term) throw new Error("Informe o e-mail ou o código de indicação.");
  const cols = "id, full_name, email, referral_code, sponsor_id";

  const [byEmail, byCode] = await Promise.all([
    admin.from("profiles").select(cols).ilike("email", term).limit(2),
    admin.from("profiles").select(cols).ilike("referral_code", term).limit(2),
  ]);
  if (byEmail.error) throw new Error(byEmail.error.message);
  if (byCode.error) throw new Error(byCode.error.message);

  const found = new Map<string, LookupRow>();
  [...(byEmail.data ?? []), ...(byCode.data ?? [])].forEach((r: LookupRow) => found.set(r.id, r));
  const list = [...found.values()];

  if (list.length === 0) {
    throw new Error("Usuário não encontrado (informe o e-mail completo ou o código de indicação).");
  }
  if (list.length > 1) throw new Error("Mais de um usuário corresponde à busca.");
  return list[0]!;
}

/** Converte erros dos gatilhos do banco em mensagens legíveis para o admin. */
function friendlySponsorError(message: string): Error {
  if (message.includes("SPONSOR_CYCLE_DETECTED")) {
    return new Error("Vínculo inválido: geraria um ciclo na rede (o indicado já está acima na árvore).");
  }
  if (message.includes("SPONSOR_SELF_REFERENCE")) {
    return new Error("Um usuário não pode patrocinar a si mesmo.");
  }
  return new Error(message);
}

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

/** Define ou remove o patrocinador (upline) de um usuário. */
export const adminSetSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; sponsor?: string | null }) =>
    z
      .object({
        userId: z.string().uuid(),
        sponsor: z.string().trim().max(255).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const term = (data.sponsor ?? "").trim();

    if (!term) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ sponsor_id: null })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "sponsor_removed",
        table_name: "profiles",
        record_id: data.userId,
        new_value: { sponsor_id: null },
      });
      return { ok: true, sponsor: null as null | { id: string; full_name: string; email: string } };
    }

    const clean = term.replace(/[%,]/g, "");
    const { data: candidates, error: findErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .or(`email.ilike.${clean},referral_code.ilike.${clean}`)
      .limit(2);
    if (findErr) throw new Error(findErr.message);
    if (!candidates || candidates.length === 0) {
      throw new Error("Patrocinador não encontrado (informe e-mail ou código de indicação).");
    }
    if (candidates.length > 1) throw new Error("Mais de um patrocinador corresponde à busca.");

    const sponsor = candidates[0]!;
    if (sponsor.id === data.userId) throw new Error("O usuário não pode patrocinar a si mesmo.");

    // Impede ciclo: o novo patrocinador não pode estar na descendência do usuário.
    const { data: cycle } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("sponsor_id", data.userId)
      .eq("referred_id", sponsor.id)
      .maybeSingle();
    if (cycle) throw new Error("Vínculo inválido: geraria um ciclo na rede.");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ sponsor_id: sponsor.id })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "sponsor_updated",
      table_name: "profiles",
      record_id: data.userId,
      new_value: { sponsor_id: sponsor.id, sponsor_email: sponsor.email },
    });

    return { ok: true, sponsor: { id: sponsor.id, full_name: sponsor.full_name, email: sponsor.email } };
  });

/** Insere um indicado direto na rede do usuário (define o usuário como patrocinador do indicado). */
export const adminAddReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sponsorId: string; referred: string }) =>
    z
      .object({
        sponsorId: z.string().uuid(),
        referred: z.string().trim().min(3).max(255),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const clean = data.referred.trim().replace(/[%,]/g, "");
    const { data: candidates, error: findErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, referral_code, sponsor_id")
      .or(`email.ilike.${clean},referral_code.ilike.${clean}`)
      .limit(2);
    if (findErr) throw new Error(findErr.message);
    if (!candidates || candidates.length === 0) {
      throw new Error("Indicado não encontrado (informe e-mail ou código de indicação).");
    }
    if (candidates.length > 1) throw new Error("Mais de um usuário corresponde à busca.");

    const referred = candidates[0]!;
    if (referred.id === data.sponsorId) throw new Error("O usuário não pode indicar a si mesmo.");

    // Impede ciclo: o patrocinador não pode estar na descendência do indicado.
    const { data: cycle } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("sponsor_id", referred.id)
      .eq("referred_id", data.sponsorId)
      .maybeSingle();
    if (cycle) throw new Error("Vínculo inválido: geraria um ciclo na rede.");

    const previousSponsor = referred.sponsor_id;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ sponsor_id: data.sponsorId })
      .eq("id", referred.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "referral_added",
      table_name: "profiles",
      record_id: referred.id,
      old_value: { sponsor_id: previousSponsor },
      new_value: { sponsor_id: data.sponsorId },
    });

    return {
      ok: true,
      referred: { id: referred.id, full_name: referred.full_name, email: referred.email },
    };
  });

/** Remove um indicado direto da rede do usuário (desvincula o patrocinador do indicado). */
export const adminRemoveReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sponsorId: string; referredId: string }) =>
    z.object({ sponsorId: z.string().uuid(), referredId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: referred, error: rErr } = await supabaseAdmin
      .from("profiles")
      .select("id, sponsor_id, email")
      .eq("id", data.referredId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!referred) throw new Error("Indicado não encontrado.");
    if (referred.sponsor_id !== data.sponsorId) {
      throw new Error("Só é possível remover indicados diretos (nível 1).");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ sponsor_id: null })
      .eq("id", data.referredId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "referral_removed",
      table_name: "profiles",
      record_id: data.referredId,
      old_value: { sponsor_id: data.sponsorId },
      new_value: { sponsor_id: null },
    });

    return { ok: true };
  });
