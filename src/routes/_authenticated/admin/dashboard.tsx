import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  Settings,
  Package,
  Gift,
  ShoppingCart,
  Image,
} from "lucide-react";
import { adminStats } from "@/lib/admin.functions";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { PageHeader, StatCard, ErrorState } from "@/components/states";
import { brl } from "@/lib/format";

const items: NavItem[] = [
  { label: "Visão geral", to: "/admin/dashboard", icon: LayoutDashboard, section: "Administração" },
  { label: "Usuários", to: "/admin/usuarios", icon: Users, section: "Gestão" },
  { label: "Planos", to: "/admin/planos", icon: ShieldCheck, section: "Gestão" },
  { label: "Pagamentos", to: "/admin/pagamentos", icon: Wallet, section: "Financeiro" },
  { label: "Saques", to: "/admin/saques", icon: Gift, section: "Financeiro" },
  { label: "Produtos", to: "/admin/produtos", icon: Package, section: "Loja" },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingCart, section: "Loja" },
  { label: "Banners", to: "/admin/banners", icon: Image, section: "Site" },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings, section: "Sistema" },
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

  const s = data;

  return (
    <AppShell items={items} variant="admin">
      <PageHeader title="Painel administrativo" description="Resumo dos últimos 30 dias." />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Usuários"
            value={s?.totalUsers ?? 0}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            label="Pagamentos confirmados"
            value={s?.plansSold ?? 0}
            icon={ShieldCheck}
            tone="success"
            loading={isLoading}
          />
          <StatCard
            label="Receita"
            value={brl(s?.paymentVolume ?? 0)}
            icon={Wallet}
            tone="secondary"
            loading={isLoading}
          />
          <StatCard
            label="Saques pendentes"
            value={s?.pendingWithdrawals ?? 0}
            icon={Wallet}
            tone="muted"
            loading={isLoading}
          />
        </div>
      )}
    </AppShell>
  );
}
