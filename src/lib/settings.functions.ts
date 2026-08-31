import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

/** Cotação interna USDT — somente administradores podem alterar. */
export const adminSaveUsdtRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rate: number }) =>
    z.object({ rate: z.number().positive().max(1000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rate = Number(data.rate.toFixed(4));

    const { error } = await supabaseAdmin
      .from("settings")
      .upsert({ key: "usdt_brl_rate", value: rate as never, is_public: true }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "usdt_rate_updated",
      table_name: "settings",
      new_value: { usdt_brl_rate: rate } as never,
    });
    return { rate };
  });

/** Atualiza links oficiais de suporte e grupos — somente administradores. */
export const adminSaveSupportLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { supportLink: string; groups: { name: string; url: string }[] }) =>
    z
      .object({
        supportLink: z.string().url().max(500),
        groups: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(60),
              url: z.string().url().max(500),
            }),
          )
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const values = [
      { key: "support_link", value: data.supportLink as never, is_public: true },
      { key: "support_groups", value: data.groups as never, is_public: true },
      // Compatibilidade com as chaves antigas usadas por versões anteriores.
      { key: "support_group", value: (data.groups[0]?.url ?? "") as never, is_public: true },
      { key: "support_group_2", value: (data.groups[1]?.url ?? "") as never, is_public: true },
    ];

    const { error } = await supabaseAdmin.from("settings").upsert(values, { onConflict: "key" });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "support_links_updated",
      table_name: "settings",
      new_value: { support_link: data.supportLink, support_groups: data.groups } as never,
    });
    return { ok: true };
  });

