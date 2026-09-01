import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dateTimeBR } from "@/lib/format";
import { useNotificationSound } from "@/lib/useNotificationSound";

export function NotificationsBell({ userId }: { userId?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const playSound = useNotificationSound();

  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications", "recent", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read_at, created_at")
        // Filtro explícito: usa o índice por usuário em vez de varrer a tabela.
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const unread = useMemo(() => data.filter((n) => !n.read_at).length, [data]);

  // Toca o "kaching" sempre que chega uma notificação nova.
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = data[0]?.id ?? null;
    if (!latest) {
      lastIdRef.current = null;
      return;
    }
    if (lastIdRef.current === null) {
      lastIdRef.current = latest;
      return;
    }
    if (lastIdRef.current !== latest) {
      lastIdRef.current = latest;
      if (!data[0]?.read_at) playSound();
    }
  }, [data, playSound]);

  const markAllRead = async () => {
    const ids = data.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const clearAll = async () => {
    if (!userId) return;
    await supabase.from("notifications").delete().eq("user_id", userId);
    lastIdRef.current = null;
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };


  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          <Link
            to="/notificacoes"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Carregando…</p>
          ) : data.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <ul className="divide-y">
              {data.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {dateTimeBR(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
