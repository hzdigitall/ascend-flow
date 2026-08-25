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
