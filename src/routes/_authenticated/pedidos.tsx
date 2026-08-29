import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { dateTimeBR, pts, dateBR } from "@/lib/format";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Arena Suplementos" },
      { name: "description", content: "Acompanhe o status dos produtos resgatados com seus pontos Arena." },
      { property: "og:title", content: "Meus pedidos — Arena Suplementos" },
      { property: "og:description", content: "Acompanhe o status dos produtos resgatados com seus pontos Arena." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <UserShell>
      <PageHeader title="Meus pedidos" description="Resgates realizados e status de entrega." />
      <Card className="shadow-card">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum pedido"
              description="Seus resgates aparecerão aqui com o código de rastreio quando disponível."
            />
          ) : (
            <ul className="divide-y">
              {data!.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{pts(o.points_used)}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{dateTimeBR(o.created_at)}</p>
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
                      <Truck className="h-3 w-3 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Prazo de envio: 15 dias</p>
                        <p>
                          {o.ship_street}, {o.ship_number}
                          {o.ship_complement ? ` - ${o.ship_complement}` : ""}
                          <br />
                          {o.ship_district}, {o.ship_city} - {o.ship_state} ({o.ship_zip})
                        </p>
                      </div>
                    </div>
                  </div>
                  {o.tracking_code && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-primary">Rastreio</p>
                      <p className="text-xs font-mono">{o.tracking_code}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
