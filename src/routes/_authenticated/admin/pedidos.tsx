import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateOrder } from "@/lib/admin.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pts, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Gestão de pedidos — Arena Suplementos" },
      { name: "description", content: "Acompanhe e atualize os resgates da loja de prêmios." },
      { property: "og:title", content: "Gestão de pedidos — Arena Suplementos" },
      { property: "og:description", content: "Status e rastreio dos pedidos." },
    ],
  }),
  component: AdminOrdersPage,
});

type OrderStatus = "placed" | "preparing" | "shipped" | "delivered" | "cancelled";

const statusLabel: Record<OrderStatus, string> = {
  placed: "Recebido",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function AdminOrdersPage() {
  const qc = useQueryClient();
  const updateOrder = useServerFn(adminUpdateOrder);
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState<OrderStatus>("preparing");
  const [tracking, setTracking] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles(full_name, email), order_items(product_name, quantity)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      updateOrder({
        data: { orderId, status, ...(tracking ? { trackingCode: tracking } : {}) },
      }),
    onSuccess: () => {
      toast.success("Pedido atualizado.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader title="Pedidos" description="Resgates realizados na loja de prêmios." />
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
                icon={ShoppingCart}
                title="Nenhum pedido"
                description="Ainda não há resgates registrados."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Pedido</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Itens</th>
                    <th className="px-6 py-4">Pontos</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">{dateTimeBR(o.created_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p>{o.profiles?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.ship_city}/{o.ship_state}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {(o.order_items ?? [])
                          .map((i) => `${i.quantity}x ${i.product_name}`)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-6 py-4">{pts(o.points_used)}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {statusLabel[o.status as OrderStatus]}
                        </span>
                        {o.tracking_code ? (
                          <p className="mt-1 text-xs text-muted-foreground">{o.tracking_code}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOrderId(o.id);
                            setStatus(o.status as OrderStatus);
                            setTracking(o.tracking_code ?? "");
                            setOpen(true);
                          }}
                        >
                          Atualizar
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
                  <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar pedido</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tracking">Código de rastreio</Label>
              <Input
                id="tracking"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
