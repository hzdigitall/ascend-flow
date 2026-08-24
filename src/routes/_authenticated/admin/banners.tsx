import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveBanner, adminToggleRecord } from "@/lib/admin-crud.functions";
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

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({
    meta: [
      { title: "Gestão de banners — Arena Saúde" },
      { name: "description", content: "Configure os banners exibidos no painel dos usuários." },
      { property: "og:title", content: "Gestão de banners — Arena Saúde" },
      { property: "og:description", content: "Administração dos banners do sistema." },
    ],
  }),
  component: AdminBannersPage,
});

type BannerForm = {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  button_label: string;
  button_url: string;
  sort_order: string;
  active: boolean;
};

const emptyBanner: BannerForm = {
  title: "",
  subtitle: "",
  image_url: "",
  button_label: "",
  button_url: "",
  sort_order: "0",
  active: true,
};

function AdminBannersPage() {
  const qc = useQueryClient();
  const saveBanner = useServerFn(adminSaveBanner);
  const toggle = useServerFn(adminToggleRecord);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyBanner);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      saveBanner({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          subtitle: form.subtitle,
          image_url: form.image_url || null,
          button_label: form.button_label || null,
          button_url: form.button_url || null,
          sort_order: Number(form.sort_order),
          active: form.active,
        },
      }),
    onSuccess: () => {
      toast.success("Banner salvo com sucesso.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      void qc.invalidateQueries({ queryKey: ["banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      toggle({ data: { table: "banners", id: v.id, active: v.active } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      void qc.invalidateQueries({ queryKey: ["banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Banners"
        description="Comunicados e destaques exibidos aos usuários."
        action={
          <Button
            onClick={() => {
              setForm(emptyBanner);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" /> Novo banner
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
                icon={ImageIcon}
                title="Nenhum banner"
                description="Cadastre o primeiro banner do sistema."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Banner</th>
                    <th className="px-6 py-4">Botão</th>
                    <th className="px-6 py-4">Ordem</th>
                    <th className="px-6 py-4">Ativo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{b.title}</p>
                        <p className="text-xs text-muted-foreground">{b.subtitle}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{b.button_label || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{b.sort_order}</td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={b.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: b.id, active: v })}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: b.id,
                              title: b.title,
                              subtitle: b.subtitle,
                              image_url: b.image_url ?? "",
                              button_label: b.button_label ?? "",
                              button_url: b.button_url ?? "",
                              sort_order: String(b.sort_order),
                              active: b.active,
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
            <DialogTitle>{form.id ? "Editar banner" : "Novo banner"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ban-title">Título</Label>
              <Input
                id="ban-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ban-sub">Subtítulo</Label>
              <Textarea
                id="ban-sub"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ban-label">Texto do botão</Label>
                <Input
                  id="ban-label"
                  value={form.button_label}
                  onChange={(e) => setForm({ ...form, button_label: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ban-url">Link do botão</Label>
                <Input
                  id="ban-url"
                  value={form.button_url}
                  onChange={(e) => setForm({ ...form, button_url: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ban-image">Imagem (URL)</Label>
              <Input
                id="ban-image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ban-order">Ordem</Label>
              <Input
                id="ban-order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="ban-active">Banner ativo</Label>
              <Switch
                id="ban-active"
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
              {save.isPending ? "Salvando..." : "Salvar banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
