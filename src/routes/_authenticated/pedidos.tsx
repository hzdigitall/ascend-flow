import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { dateTimeBR, pts } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Arena Saúde" },
      { name: "description", content: "Acompanhe o status dos produtos resgatados com seus pontos Arena." },
      { property: "og:title", content: "Meus pedidos — Arena Saúde" },
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pts(o.points_used)}</p>
                    <p className="text-xs text-muted-foreground">{dateTimeBR(o.created_at)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
