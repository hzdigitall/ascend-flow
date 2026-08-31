import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Users, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
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
import { UsdtRateCard } from "@/components/admin/UsdtRateCard";
import { normalizeRate } from "@/lib/usdt";
import { WhatsappAutomationCard } from "@/components/admin/WhatsappAutomationCard";
import { adminSaveSupportLinks } from "@/lib/settings.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const items: NavItem[] = [
  { label: "Visão geral", to: "/admin/dashboard", icon: LayoutDashboard, section: "Administração" },
  { label: "Usuários", to: "/admin/usuarios", icon: UsersIcon, section: "Gestão" },
  { label: "Planos", to: "/admin/planos", icon: ShieldCheck, section: "Gestão" },
  { label: "Pagamentos", to: "/admin/pagamentos", icon: Wallet, section: "Financeiro" },
  { label: "Saques", to: "/admin/saques", icon: Gift, section: "Financeiro" },
  { label: "Produtos", to: "/admin/produtos", icon: Package, section: "Loja" },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingCart, section: "Loja" },
  { label: "Banners", to: "/admin/banners", icon: Image, section: "Site" },
  { label: "Gateways", to: "/admin/gateways", icon: PlugZap, section: "Financeiro" },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings, section: "Sistema" },
];

type SupportGroup = { name: string; url: string };

function SupportLinksCard({
  supportLink,
  groups: initialGroups,
  onSaved,
}: {
  supportLink: string;
  groups: SupportGroup[];
  onSaved: () => void;
}) {
  const save = useServerFn(adminSaveSupportLinks);
  const [link, setLink] = useState(supportLink);
  const [groups, setGroups] = useState<SupportGroup[]>(initialGroups);
  const [saving, setSaving] = useState(false);

  const updateGroup = (index: number, patch: Partial<SupportGroup>) =>
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          supportLink: link.trim(),
          groups: groups.map((g) => ({ name: g.name.trim(), url: g.url.trim() })),
        },
      });
      toast.success("Links de suporte atualizados.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar links.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Links de suporte</CardTitle>
        <CardDescription>
          WhatsApp de atendimento e grupos oficiais exibidos no menu lateral dos usuários. Adicione
          quantos grupos quiser, com o nome que aparecerá no botão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="support-link" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp de suporte
            </Label>
            <Input
              id="support-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://wa.me/..."
              required
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Grupos
            </Label>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>
            ) : null}
            {groups.map((g, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={g.name}
                  onChange={(e) => updateGroup(i, { name: e.target.value })}
                  placeholder="Nome do botão (ex.: Grupo G1)"
                  className="sm:w-56"
                  required
                />
                <Input
                  type="url"
                  value={g.url}
                  onChange={(e) => updateGroup(i, { url: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                  className="flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover grupo"
                  onClick={() => setGroups((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGroups((prev) => [...prev, { name: "", url: "" }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar grupo
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar links"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do sistema — Arena Suplementos" },
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
  const supportLink = String(data?.find((s) => s.key === "support_link")?.value ?? "");
  const rawGroups = data?.find((s) => s.key === "support_groups")?.value;
  const legacyG1 = String(data?.find((s) => s.key === "support_group")?.value ?? "");
  const legacyG2 = String(data?.find((s) => s.key === "support_group_2")?.value ?? "");
  const groups: SupportGroup[] = Array.isArray(rawGroups)
    ? (rawGroups as SupportGroup[]).map((g) => ({ name: String(g?.name ?? ""), url: String(g?.url ?? "") }))
    : [
        ...(legacyG1 ? [{ name: "Grupo G1", url: legacyG1 }] : []),
        ...(legacyG2 ? [{ name: "Grupo G2", url: legacyG2 }] : []),
      ];

  return (
    <AppShell items={items} variant="admin">
      <PageHeader title="Configurações" description="Ajuste as variáveis globais do sistema." />
      <UsdtRateCard currentRate={normalizeRate(rateValue)} onSaved={() => void refetch()} />
      <WhatsappAutomationCard />
      <SupportLinksCard
        key={`${supportLink}|${JSON.stringify(groups)}`}
        supportLink={supportLink}
        groups={groups}
        onSaved={() => void refetch()}
      />

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
