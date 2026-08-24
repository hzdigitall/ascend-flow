import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function assertAdmin(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}
