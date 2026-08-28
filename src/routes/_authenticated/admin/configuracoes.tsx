import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutDashboard,
  ShieldCheck,
  Users as UsersIcon,
  Wallet,
  Settings,
  Package,
  Gift,
  ShoppingCart,
  Image,
  PlugZap,
} from "lucide-react";
import { brl, dateTimeBR } from "@/lib/format";
import { UsdtRateCard } from "@/components/admin/UsdtRateCard";
import { normalizeRate } from "@/lib/usdt";
import { WhatsappAutomationCard } from "@/components/admin/WhatsappAutomationCard";
import { adminSaveSupportLinks } from "@/lib/settings.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const items: NavItem[] = [
  { label: "Visão geral", to: "/admin/dashboard", icon: LayoutDashboard, section: "Administração" },
  { label: "Usuários", to: "/admin/usuarios", icon: Users, section: "Gestão" },
  { label: "Planos", to: "/admin/planos", icon: ShieldCheck, section: "Gestão" },
  { label: "Pagamentos", to: "/admin/pagamentos", icon: Wallet, section: "Financeiro" },
  { label: "Saques", to: "/admin/saques", icon: Gift, section: "Financeiro" },
  { label: "Produtos", to: "/admin/produtos", icon: Package, section: "Loja" },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingCart, section: "Loja" },
  { label: "Banners", to: "/admin/banners", icon: Image, section: "Site" },
  { label: "Gateways", to: "/admin/gateways", icon: PlugZap, section: "Financeiro" },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings, section: "Sistema" },
];

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do sistema — Arena Saúde" },
      { name: "description", content: "Ajuste taxas, nomes e comportamentos da plataforma." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("key", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const rateValue = data?.find((s) => s.key === "usdt_brl_rate")?.value;

  return (
    <AppShell items={items} variant="admin">
      <PageHeader title="Configurações" description="Ajuste as variáveis globais do sistema." />
      <UsdtRateCard currentRate={normalizeRate(rateValue)} onSaved={() => void refetch()} />
      <WhatsappAutomationCard />
      <Card className="shadow-card">

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-6">
              <ErrorState onRetry={() => refetch()} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Chave</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4 text-center">Público</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((s) => (
                    <tr key={s.key} className="group hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s.key}</code>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {JSON.stringify(s.value)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            s.is_public
                              ? "bg-success/12 text-success"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {s.is_public ? "Sim" : "Não"}
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
