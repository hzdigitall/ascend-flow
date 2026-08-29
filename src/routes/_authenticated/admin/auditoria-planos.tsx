import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/auditoria-planos")({
  head: () => ({
    meta: [
      { title: "Auditoria de planos — Arena Suplementos" },
      {
        name: "description",
        content: "Histórico de expiração, ativação e ciclos concluídos dos planos dos usuários.",
      },
      { property: "og:title", content: "Auditoria de planos — Arena Suplementos" },
      { property: "og:description", content: "Trilha de auditoria dos planos Arena Suplementos." },
    ],
  }),
  component: AdminPlanAuditPage,
});

const eventLabel: Record<string, string> = {
  plan_activated: "Plano ativado",
  plan_expired: "Plano expirado",
  plan_cancelled: "Plano cancelado",
  plan_cycle_completed: "Ciclo concluído",
  plan_expiring_notified: "Aviso de vencimento",
  plan_status_changed: "Status alterado",
};

const eventTone = (event: string) =>
  event === "plan_expired" || event === "plan_cancelled"
    ? "destructive"
    : event === "plan_activated" || event === "plan_cycle_completed"
      ? "default"
      : "secondary";

function AdminPlanAuditPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "plan-audit"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_audit_logs")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((row: any) => {
    if (!term) return true;
    const profile = row.profiles as { full_name?: string; email?: string } | null;
    return (
      row.plan_name?.toLowerCase().includes(term) ||
      profile?.full_name?.toLowerCase().includes(term) ||
      profile?.email?.toLowerCase().includes(term) ||
      eventLabel[row.event]?.toLowerCase().includes(term)
    );
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Auditoria de planos"
        description="Histórico de ativações, vencimentos e ciclos concluídos, direto do banco de dados."
      />

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Buscar por usuário, e-mail, plano ou evento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum registro encontrado"
          description="Os eventos de planos aparecerão aqui automaticamente."
        />
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Usuário</th>
                    <th className="p-3 font-medium">Plano</th>
                    <th className="p-3 font-medium">Evento</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Rendido</th>
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
                        <td className="whitespace-nowrap p-3">{dateTimeBR(row.created_at)}</td>
                        <td className="p-3">
                          <div className="font-medium">{profile?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{profile?.email}</div>
                        </td>
                        <td className="p-3">{row.plan_name || "—"}</td>
                        <td className="p-3">
                          <Badge variant={eventTone(row.event) as any}>
                            {eventLabel[row.event] ?? row.event}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap p-3 text-muted-foreground">
                          {row.old_status ?? "—"} → {row.new_status ?? "—"}
                        </td>
                        <td className="p-3">{brl(Number(row.earned_total ?? 0))}</td>
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
