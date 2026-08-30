import { useCallback, useMemo } from "react";
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
    // Configurações mudam raramente: cache longo evita request a cada tela.
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const data = query.data;

  // `get` estável entre renders para não invalidar memos dos consumidores.
  const get = useCallback(
    <T,>(key: string, fallback: T): T => {
      const value = data?.[key];
      return (value === undefined || value === null ? fallback : value) as T;
    },
    [data],
  );

  return useMemo(() => ({ ...query, get }), [query, get]);
}

export function usePlatformName() {
  const { get } = useSettings();
  return get<string>("platform_name", "Arena Suplementos");
}
