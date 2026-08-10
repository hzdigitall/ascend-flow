import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, ShieldCheck, Users, Wallet } from "lucide-react";
import { adminStats } from "@/lib/admin.functions";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { PageHeader, StatCard, ErrorState } from "@/components/states";
import { brl } from "@/lib/format";

const items: NavItem[] = [
  { label: "Visão geral", to: "/admin/dashboard", icon: LayoutDashboard, section: "Administração" },
];

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — Nexora" },
      { name: "description", content: "Indicadores gerais de usuários, pagamentos e saques." },
      { property: "og:title", content: "Painel administrativo — Nexora" },
      { property: "og:description", content: "Indicadores gerais da plataforma." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useServerFn(adminStats);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => stats({ data: { days: 30 } }),
  });

  const s = data as Record<string, number> | undefined;

  return (
    <AppShell items={items} variant="admin">
      <PageHeader title="Painel administrativo" description="Resumo dos últimos 30 dias." />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Usuários"
            value={s?.["users"] ?? 0}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            label="Pagamentos confirmados"
            value={s?.["paidPayments"] ?? 0}
            icon={ShieldCheck}
            tone="success"
            loading={isLoading}
          />
          <StatCard
            label="Receita"
            value={brl(s?.["revenue"] ?? 0)}
            icon={Wallet}
            tone="purple"
            loading={isLoading}
          />
          <StatCard
            label="Saques pendentes"
            value={s?.["pendingWithdrawals"] ?? 0}
            icon={Wallet}
            tone="muted"
            loading={isLoading}
          />
        </div>
      )}
    </AppShell>
  );
}
