import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard.server";

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().min(2).max(400),
        price: z.number().min(0),
        points: z.number().int().min(0),
        validity_days: z.number().int().min(1).max(3650),
        benefits: z.array(z.string().trim().min(1)).max(20),
        sort_order: z.number().int().min(0).max(999),
        active: z.boolean(),
        image_url: z.string().trim().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const payload = { ...rest, image_url: data.image_url || null, updated_at: new Date().toISOString() };
    const { error } = id
      ? await supabaseAdmin.from("plans").update(payload).eq("id", id)
      : await supabaseAdmin.from("plans").insert(payload);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.id ? "plan_updated" : "plan_created",
      table_name: "plans",
      record_id: data.id ?? null,
      new_value: payload,
    });
    return { ok: true };
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().min(2).max(600),
        points_cost: z.number().int().min(0),
        stock: z.number().int().min(0),
        sku: z.string().trim().max(60).nullable().optional(),
        image_url: z.string().trim().max(500).nullable().optional(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      sku: data.sku || null,
      image_url: data.image_url || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await supabaseAdmin.from("products").update(payload).eq("id", id)
      : await supabaseAdmin.from("products").insert(payload);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.id ? "product_updated" : "product_created",
      table_name: "products",
      record_id: data.id ?? null,
      new_value: payload,
    });
    return { ok: true };
  });

export const adminSaveBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(120),
        subtitle: z.string().trim().min(2).max(200),
        image_url: z.string().trim().max(500).nullable().optional(),
        button_label: z.string().trim().max(60).nullable().optional(),
        button_url: z.string().trim().max(300).nullable().optional(),
        sort_order: z.number().int().min(0).max(999),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      image_url: data.image_url || null,
      button_label: data.button_label || null,
      button_url: data.button_url || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await supabaseAdmin.from("banners").update(payload).eq("id", id)
      : await supabaseAdmin.from("banners").insert(payload);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.id ? "banner_updated" : "banner_created",
      table_name: "banners",
      record_id: data.id ?? null,
      new_value: payload,
    });
    return { ok: true };
  });

export const adminToggleRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        table: z.enum(["plans", "products", "banners"]),
        id: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from(data.table)
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "record_toggled",
      table_name: data.table,
      record_id: data.id,
      new_value: { active: data.active },
    });
    return { ok: true };
  });
