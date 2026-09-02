import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminConfirmPayment } from "@/lib/admin.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pagamentos")({
  head: () => ({
    meta: [
      { title: "Gestão de pagamentos — Arena Suplementos" },
      { name: "description", content: "Acompanhe pagamentos PIX e confirme manualmente quando necessário." },
      { property: "og:title", content: "Gestão de pagamentos — Arena Suplementos" },
      { property: "og:description", content: "Controle financeiro dos pagamentos da plataforma." },
    ],
  }),
  component: AdminPaymentsPage,
});

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const confirm = useServerFn(adminConfirmPayment);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const confirmPayment = useMutation({
    mutationFn: (paymentId: string) =>
      confirm({ data: { paymentId, note: "Confirmação manual pelo painel." } }),
    onSuccess: () => {
      toast.success("Pagamento confirmado e créditos liberados.");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Pagamentos"
        description="Confirme manualmente pagamentos PIX quando o gateway falhar."
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
                icon={Wallet}
                title="Nenhum pagamento"
                description="Ainda não há pagamentos registrados."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Gateway</th>
                    <th className="px-6 py-4">Criado em</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{p.profiles?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.profiles?.email ?? ""}</p>
                      </td>
                      <td className="px-6 py-4">{brl(p.amount)}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {p.gateway === "admin"
                          ? "Ativação de patrocínio manual"
                          : p.gateway === "balance"
                            ? "Saldo interno"
                            : p.gateway}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {dateTimeBR(p.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {statusLabel[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={() => confirmPayment.mutate(p.id)}
                            disabled={confirmPayment.isPending}
                          >
                            Confirmar
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
