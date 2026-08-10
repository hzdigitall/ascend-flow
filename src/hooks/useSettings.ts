import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SettingsMap = Record<string, unknown>;

export function useSettings() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key, value");
      if (error) throw error;
      const map: SettingsMap = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
    staleTime: 60_000,
  });

  const get = <T,>(key: string, fallback: T): T => {
    const value = query.data?.[key];
    return (value === undefined || value === null ? fallback : value) as T;
  };

  return { ...query, get };
}

export function usePlatformName() {
  const { get } = useSettings();
  return get<string>("platform_name", "Nexora");
}
