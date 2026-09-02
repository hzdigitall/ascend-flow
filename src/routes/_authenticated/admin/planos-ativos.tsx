import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/planos-ativos")({
  head: () => ({
    meta: [
      { title: "Planos ativos dos usuários — Arena Suplementos" },
      {
        name: "description",
        content: "Lista de todos os planos ativos dos usuários, com valor, pontos e vencimento.",
      },
      { property: "og:title", content: "Planos ativos dos usuários — Arena Suplementos" },
      {
        property: "og:description",
        content: "Acompanhe os planos ativos de cada usuário da Arena Suplementos.",
      },
    ],
  }),
  component: AdminActivePlansPage,
});

function AdminActivePlansPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "active-plans"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*, profiles(full_name, email)")
        .eq("status", "active")
        .order("activated_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((row: any) => {
    if (!term) return true;
    const profile = row.profiles as { full_name?: string; email?: string } | null;
    return (
      row.plan_name?.toLowerCase().includes(term) ||
      profile?.full_name?.toLowerCase().includes(term) ||
      profile?.email?.toLowerCase().includes(term)
    );
  });

  const total = rows.reduce((acc: number, row: any) => acc + Number(row.price ?? 0), 0);

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Planos ativos"
        description="Todos os planos atualmente ativos, por usuário, com montante e vencimento."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por usuário, e-mail ou plano"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => refetch()}>
          Atualizar
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {rows.length} plano(s) — montante total {brl(total)}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum plano ativo encontrado"
          description="Assim que um plano for ativado, ele aparecerá aqui."
        />
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Usuário</th>
                    <th className="p-3 font-medium">Plano</th>
                    <th className="p-3 font-medium">Valor</th>
                    <th className="p-3 font-medium">Pontos</th>
                    <th className="p-3 font-medium">Ativado em</th>
                    <th className="p-3 font-medium">Vence em</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => {
                    const profile = row.profiles as {
                      full_name?: string;
                      email?: string;
                    } | null;
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-medium">{profile?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{profile?.email}</div>
                        </td>
                        <td className="p-3">{row.plan_name || "—"}</td>
                        <td className="whitespace-nowrap p-3">{brl(Number(row.price ?? 0))}</td>
                        <td className="p-3">{row.points_granted ?? 0}</td>
                        <td className="whitespace-nowrap p-3 text-muted-foreground">
                          {row.activated_at ? dateTimeBR(row.activated_at) : "—"}
                        </td>
                        <td className="whitespace-nowrap p-3 text-muted-foreground">
                          {row.expires_at ? dateTimeBR(row.expires_at) : "—"}
                        </td>
                        <td className="p-3">
                          <Badge>Ativo</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
