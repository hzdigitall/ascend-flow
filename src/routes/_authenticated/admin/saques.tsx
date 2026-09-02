import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Gift, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, dateTimeBR } from "@/lib/format";
import {
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminReconcileWithdrawal,
} from "@/lib/payouts.functions";

export const Route = createFileRoute("/_authenticated/admin/saques")({
  head: () => ({
    meta: [
      { title: "Gestão de saques — Arena Suplementos" },
      {
        name: "description",
        content: "Aprove, rejeite e reconcilie saques em PIX e USDT BEP20.",
      },
    ],
  }),
  component: WithdrawalsPage,
});

type Row = {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  currency: string | null;
  method: string | null;
  network: string | null;
  wallet_type: string;
  pix_key_type: string | null;
  pix_key_value: string | null;
  wallet_address: string | null;
  provider: string | null;
  provider_transaction_id: string | null;
  tx_hash: string | null;
  reject_reason: string | null;
  conversion_rate: number | null;
  crypto_amount: number | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};

/**
 * Saques novos são registrados em BRL (com o valor em USDT congelado em
 * `crypto_amount`). Saques USDT legados guardavam o valor direto em USDT.
 */
function money(row: Row, value: number) {
  const legacyUsdt = row.currency === "USDT" && row.crypto_amount === null;
  return legacyUsdt ? `${value.toFixed(2)} USDT` : brl(value);
}

function WithdrawalsPage() {
  const approveFn = useServerFn(adminApproveWithdrawal);
  const rejectFn = useServerFn(adminRejectWithdrawal);
  const reconcileFn = useServerFn(adminReconcileWithdrawal);

  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [approveTarget, setApproveTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { withdrawalId: id } }),
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reject = useMutation({
    mutationFn: (payload: { withdrawalId: string; reason: string }) => rejectFn({ data: payload }),
    onSuccess: () => {
      toast.success("Saque rejeitado e saldo devolvido ao usuário.");
      setRejectTarget(null);
      setReason("");
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reconcile = useMutation({
    mutationFn: (id: string) => reconcileFn({ data: { withdrawalId: id } }),
    onSuccess: (res) => {
      toast.success(res.message);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
<PageHeader
        title="Saques"
        description="Saques PIX até R$ 1.000 são enviados automaticamente à gateway. Acima disso, aprovação manual obrigatória. Saques em USDT são sempre automáticos."
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
                icon={Gift}
                title="Nenhum saque"
                description="Não há solicitações de saque no momento."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Valor / Líquido</th>
                    <th className="px-6 py-4">Destino</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((w) => {
                    const pendingApproval = w.status === "pending";
                    const inFlight = w.status === "submitting" || w.status === "processing";
                    return (
                      <tr key={w.id} className="group align-top hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{w.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{w.profiles?.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold">{money(w, Number(w.amount))}</p>
                          <p className="text-xs text-muted-foreground">
                            Taxa: {money(w, Number(w.fee))} · Líquido:{" "}
                            {money(w, Number(w.net_amount))}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {w.currency === "USDT" ? (
                            <>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                USDT {w.network ?? "BEP20"}
                              </p>
                              <p className="break-all text-xs text-muted-foreground">
                                {w.wallet_address}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {w.provider === "nowpayments"
                                  ? "Provedor legado (histórico)"
                                  : "ConnectPay"}
                              </p>
                              {w.crypto_amount !== null && (
                                <p className="text-xs font-medium">
                                  Envio: {Number(w.crypto_amount).toFixed(6)} USDT · cotação R${" "}
                                  {Number(w.conversion_rate ?? 0).toFixed(2)}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                PIX {w.pix_key_type}
                              </p>
                              <p className="break-all text-xs text-muted-foreground">
                                {w.pix_key_value}
                              </p>
                            </>
                          )}
                          {w.tx_hash ? (
                            <p className="mt-1 break-all text-[11px] text-muted-foreground">
                              hash: {w.tx_hash}
                            </p>
                          ) : null}
                          {w.reject_reason ? (
                            <p className="mt-1 text-[11px] text-destructive">{w.reject_reason}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {dateTimeBR(w.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {pendingApproval ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => setApproveTarget(w)}
                                  disabled={approve.isPending}
                                >
                                  Aprovar e enviar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectTarget(w);
                                    setReason("");
                                  }}
                                >
                                  Rejeitar
                                </Button>
                              </>
                            ) : null}
                            {inFlight ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reconcile.mutate(w.id)}
                                disabled={reconcile.isPending}
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Reconciliar
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(approveTarget)} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio do saque</DialogTitle>
            <DialogDescription>
              {approveTarget?.currency === "USDT"
                ? `Enviar ${Number(approveTarget?.crypto_amount ?? 0).toFixed(6)} USDT na rede ${approveTarget?.network ?? "BEP20"} para ${approveTarget?.wallet_address}. Esta operação é irreversível.`
                : `Enviar o PIX de R$ ${Number(approveTarget?.net_amount ?? 0).toFixed(2)} para a chave ${approveTarget?.pix_key_value ?? ""}. Esta operação é irreversível.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={approve.isPending}
              onClick={() => {
                if (approveTarget) approve.mutate(approveTarget.id);
                setApproveTarget(null);
              }}
            >
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar saque</DialogTitle>
            <DialogDescription>
              O valor reservado será devolvido integralmente à carteira de origem do usuário.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (visível ao usuário)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || reject.isPending}
              onClick={() =>
                rejectTarget &&
                reject.mutate({ withdrawalId: rejectTarget.id, reason: reason.trim() })
              }
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
