import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
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
import { brl, dateTimeBR } from "@/lib/format";

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

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Gestão de usuários — Nexora" },
      { name: "description", content: "Administração de usuários cadastrados no sistema." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell items={items} variant="admin">
      <PageHeader title="Usuários" description="Gerencie os usuários da plataforma." />
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-6">
              <ErrorState onRetry={() => refetch()} />
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhum usuário"
                description="Ainda não há usuários cadastrados."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Nome / E-mail</th>
                    <th className="px-6 py-4">CPF / WhatsApp</th>
                    <th className="px-6 py-4">Cadastro</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((u) => (
                    <tr key={u.id} className="group hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-muted-foreground">{u.cpf || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.phone || "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {dateTimeBR(u.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            u.blocked
                              ? "bg-destructive/12 text-destructive"
                              : "bg-success/12 text-success",
                          )}
                        >
                          {u.blocked ? "Bloqueado" : "Ativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

import { cn } from "@/lib/utils";
