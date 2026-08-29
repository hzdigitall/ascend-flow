import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveProduct, adminToggleRecord } from "@/lib/admin-crud.functions";
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
import { pts } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Gestão de produtos — Arena Suplementos" },
      { name: "description", content: "Cadastre produtos, custo em pontos e estoque da loja de prêmios." },
      { property: "og:title", content: "Gestão de produtos — Arena Suplementos" },
      { property: "og:description", content: "Administração da loja de prêmios." },
    ],
  }),
  component: AdminProductsPage,
});

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  points_cost: string;
  stock: string;
  sku: string;
  image_url: string;
  active: boolean;
};

const emptyProduct: ProductForm = {
  name: "",
  description: "",
  points_cost: "250",
  stock: "0",
  sku: "",
  image_url: "",
  active: true,
};

function AdminProductsPage() {
  const qc = useQueryClient();
  const saveProduct = useServerFn(adminSaveProduct);
  const toggle = useServerFn(adminToggleRecord);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProduct);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name,
          description: form.description,
          points_cost: Number(form.points_cost),
          stock: Number(form.stock),
          sku: form.sku || null,
          image_url: form.image_url || null,
          active: form.active,
        },
      }),
    onSuccess: () => {
      toast.success("Produto salvo com sucesso.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      toggle({ data: { table: "products", id: v.id, active: v.active } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Produtos"
        description="Gerencie os itens disponíveis na loja de prêmios."
        action={
          <Button
            onClick={() => {
              setForm(emptyProduct);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" /> Novo produto
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
                icon={Package}
                title="Nenhum produto"
                description="Cadastre o primeiro produto da loja."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4">Custo</th>
                    <th className="px-6 py-4">Estoque</th>
                    <th className="px-6 py-4">Ativo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="size-10 rounded-md object-contain"
                              loading="lazy"
                            />
                          ) : null}
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.sku || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{pts(p.points_cost)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{p.stock}</td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={p.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })}
                        />
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
                              points_cost: String(p.points_cost),
                              stock: String(p.stock),
                              sku: p.sku ?? "",
                              image_url: p.image_url ?? "",
                              active: p.active,
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
            <DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prod-name">Nome</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-desc">Descrição</Label>
              <Textarea
                id="prod-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="prod-points">Custo em pontos</Label>
                <Input
                  id="prod-points"
                  type="number"
                  value={form.points_cost}
                  onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-stock">Estoque</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-sku">SKU</Label>
              <Input
                id="prod-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prod-image">Imagem (URL)</Label>
              <Input
                id="prod-image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="prod-active">Produto ativo</Label>
              <Switch
                id="prod-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
