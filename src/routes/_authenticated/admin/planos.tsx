import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminSavePlan, adminToggleRecord } from "@/lib/admin-crud.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/planos")({
  head: () => ({
    meta: [
      { title: "Gestão de planos — Arena Saúde" },
      { name: "description", content: "Cadastre e edite planos, valores, pontos e benefícios." },
      { property: "og:title", content: "Gestão de planos — Arena Saúde" },
      { property: "og:description", content: "Administração dos planos da plataforma." },
    ],
  }),
  component: AdminPlansPage,
});

type PlanForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  points: string;
  validity_days: string;
  benefits: string;
  sort_order: string;
  active: boolean;
  purchase_blocked: boolean;
  image_url: string;
};

const emptyPlan: PlanForm = {
  name: "",
  description: "",
  price: "0",
  points: "0",
  validity_days: "365",
  benefits: "",
  sort_order: "0",
  active: true,
  purchase_blocked: false,
  image_url: "",
};

function AdminPlansPage() {
  const qc = useQueryClient();
  const savePlan = useServerFn(adminSavePlan);
  const toggle = useServerFn(adminToggleRecord);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>(emptyPlan);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      savePlan({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name,
          description: form.description,
          price: Number(form.price),
          points: Number(form.points),
          validity_days: Number(form.validity_days),
          benefits: form.benefits
            .split("\n")
            .map((b) => b.trim())
            .filter(Boolean),
          sort_order: Number(form.sort_order),
          active: form.active,
          purchase_blocked: form.purchase_blocked,
          image_url: form.image_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Plano salvo com sucesso.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      toggle({ data: { table: "plans", id: v.id, active: v.active } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Planos"
        description="Cadastre e edite os planos vendidos na plataforma."
        action={
          <Button
            onClick={() => {
              setForm(emptyPlan);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" /> Novo plano
          </Button>
        }
      />

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
                icon={ShieldCheck}
                title="Nenhum plano"
                description="Cadastre o primeiro plano da plataforma."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Plano</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Pontos</th>
                    <th className="px-6 py-4">Validade</th>
                    <th className="px-6 py-4">Ativo</th>
                    <th className="px-6 py-4">Aquisição</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </td>
                      <td className="px-6 py-4">{brl(p.price)}</td>
                      <td className="px-6 py-4">{p.points}</td>
                      <td className="px-6 py-4 text-muted-foreground">{p.validity_days} dias</td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={p.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })}
                        />
                      </td>
                      <td className="px-6 py-4">
                        {p.purchase_blocked ? (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                            Bloqueada
                          </span>
                        ) : (
                          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            Liberada
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: p.id,
                              name: p.name,
                              description: p.description,
                              price: String(p.price),
                              points: String(p.points),
                              validity_days: String(p.validity_days),
                              benefits: (p.benefits ?? []).join("\n"),
                              sort_order: String(p.sort_order),
                              active: p.active,
                              purchase_blocked: p.purchase_blocked ?? false,
                              image_url: p.image_url ?? "",
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="plan-name">Nome</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-desc">Descrição</Label>
              <Textarea
                id="plan-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="plan-price">Valor (R$)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-points">Pontos</Label>
                <Input
                  id="plan-points"
                  type="number"
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-validity">Validade (dias)</Label>
                <Input
                  id="plan-validity"
                  type="number"
                  value={form.validity_days}
                  onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-order">Ordem</Label>
                <Input
                  id="plan-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-benefits">Benefícios (um por linha)</Label>
              <Textarea
                id="plan-benefits"
                rows={4}
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-image">Imagem (URL)</Label>
              <Input
                id="plan-image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="plan-active">Plano ativo</Label>
              <Switch
                id="plan-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="plan-blocked">Bloquear aquisição</Label>
                <p className="text-xs text-muted-foreground">
                  Exibe “Indisponível para aquisição no momento” para o usuário.
                </p>
              </div>
              <Switch
                id="plan-blocked"
                checked={form.purchase_blocked}
                onCheckedChange={(v) => setForm({ ...form, purchase_blocked: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
