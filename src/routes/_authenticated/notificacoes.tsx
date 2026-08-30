import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Arena Suplementos" },
      { name: "description", content: "Avisos sobre pagamentos, comissões, saques e pedidos da sua conta." },
      { property: "og:title", content: "Notificações — Arena Suplementos" },
      { property: "og:description", content: "Avisos sobre pagamentos, comissões, saques e pedidos da sua conta." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <UserShell>
      <PageHeader title="Notificações" description="Tudo o que aconteceu na sua conta." />
      <Card className="shadow-card">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState icon={Bell} title="Sem notificações" description="Você está em dia." />
          ) : (
            <ul className="divide-y">
              {data!.map((n) => (
                <li key={n.id} className="py-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateTimeBR(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
