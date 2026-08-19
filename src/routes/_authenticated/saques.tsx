import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote } from "lucide-react";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/saques")({
  head: () => ({
    meta: [
      { title: "Saques — Arena Saúde" },
      { name: "description", content: "Solicite saques via PIX e acompanhe o status de cada pedido na Arena Saúde." },
      { property: "og:title", content: "Saques — Arena Saúde" },
      { property: "og:description", content: "Solicite saques via PIX e acompanhe o status de cada pedido na Arena Saúde." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <UserShell>
      <PageHeader title="Saques" description="Acompanhe suas solicitações de saque via PIX. Rendimentos às segundas (10h-17h) e Bônus diariamente (09h-17h)." />
      <Card className="shadow-card">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Nenhum saque solicitado"
              description="Quando você solicitar um saque ele aparecerá aqui com o status atualizado."
            />
          ) : (
            <ul className="divide-y">
              {data!.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{brl(w.amount)}</p>
                    <p className="text-xs text-muted-foreground">{dateTimeBR(w.created_at)}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
