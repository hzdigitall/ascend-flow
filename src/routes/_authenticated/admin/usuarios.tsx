import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAdjustBalance,
  adminAdjustPoints,
  adminDeleteUser,
  adminGrantPlan,
  adminSendPasswordReset,
  adminUpdateUser,
} from "@/lib/admin.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, dateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Gestão de usuários — Arena Saúde" },
      { name: "description", content: "Bloqueio, permissões, saldos e planos dos usuários." },
      { property: "og:title", content: "Gestão de usuários — Arena Saúde" },
      { property: "og:description", content: "Administração dos usuários da plataforma." },
    ],
  }),
  component: UsersPage,
});

type Target = { id: string; name: string };

const walletLabels: Record<string, string> = {
  main: "Saldo principal",
  earnings: "Rendimentos",
  referral: "Bônus de indicação",
  usdt: "Saldo USDT",
};

function UsersPage() {
  const qc = useQueryClient();
  const updateUser = useServerFn(adminUpdateUser);
  const adjustPoints = useServerFn(adminAdjustPoints);
  const adjustBalance = useServerFn(adminAdjustBalance);
  const grantPlan = useServerFn(adminGrantPlan);
  const deleteUser = useServerFn(adminDeleteUser);
  const sendReset = useServerFn(adminSendPasswordReset);

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [points, setPoints] = useState("0");
  const [reason, setReason] = useState("");

  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState<Target | null>(null);
  const [wallet, setWallet] = useState("main");
  const [amount, setAmount] = useState("0");
  const [balanceReason, setBalanceReason] = useState("");

  const [planOpen, setPlanOpen] = useState(false);
  const [planTarget, setPlanTarget] = useState<Target | null>(null);
  const [planId, setPlanId] = useState("");
  const [planReason, setPlanReason] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const [profiles, roles, wallets] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("wallets").select("*"),
      ]);
      if (profiles.error) throw profiles.error;
      const adminIds = new Set(
        (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      const walletMap = new Map((wallets.data ?? []).map((w) => [w.user_id, w]));
      const nameMap = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
      return (profiles.data ?? []).map((p) => ({
        ...p,
        isAdmin: adminIds.has(p.id),
        wallet: walletMap.get(p.id) ?? null,
        sponsorName: p.sponsor_id ? (nameMap.get(p.sponsor_id) ?? "Usuário removido") : null,
      }));
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["admin", "plans", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, price")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const selectedPlan = useMemo(
    () => (plans ?? []).find((p) => p.id === planId) ?? null,
    [plans, planId],
  );

  const mutateUser = useMutation({
    mutationFn: (v: { userId: string; blocked?: boolean; makeAdmin?: boolean }) =>
      updateUser({ data: v }),
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: (email: string) =>
      sendReset({ data: { email, redirectTo: `${SITE_URL}/login` } }),
    onSuccess: () => toast.success("E-mail de redefinição enviado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const savePoints = useMutation({
    mutationFn: () =>
      adjustPoints({
        data: { userId: target!.id, points: Number(points), reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success("Pontos ajustados.");
      setOpen(false);
      setPoints("0");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBalance = useMutation({
    mutationFn: () =>
      adjustBalance({
        data: {
          userId: balanceTarget!.id,
          wallet: wallet as "main" | "earnings" | "referral" | "usdt",
          amount: Number(amount.replace(",", ".")),
          reason: balanceReason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Saldo ajustado.");
      setBalanceOpen(false);
      setAmount("0");
      setBalanceReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePlan = useMutation({
    mutationFn: () =>
      grantPlan({
        data: planReason.trim()
          ? { userId: planTarget!.id, planId, reason: planReason.trim() }
          : { userId: planTarget!.id, planId },
      }),
    onSuccess: () => {
      toast.success("Plano ativado manualmente (sem geração de comissões).");
      setPlanOpen(false);
      setPlanId("");
      setPlanReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: () => deleteUser({ data: { userId: deleteTarget!.id } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
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
                    <th className="px-6 py-4">Patrocínio</th>
                    <th className="px-6 py-4">Saldos</th>
                    <th className="px-6 py-4">Cadastro</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Admin</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((u) => (
                    <tr key={u.id} className="group hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.cpf || "—"} · {u.phone || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        {u.sponsorName ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary"
                            title={`Patrocinado por ${u.sponsorName}`}
                          >
                            Patrocinado
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Direto
                          </span>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {u.sponsorName ?? "Sem patrocinador"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        <p>Principal: {brl(Number(u.wallet?.main_balance ?? 0))}</p>
                        <p>Rend.: {brl(Number(u.wallet?.earnings_balance ?? 0))}</p>
                        <p>Bônus: {brl(Number(u.wallet?.referral_balance ?? 0))}</p>
                        <p>USDT: {Number(u.wallet?.usdt_balance ?? 0).toFixed(2)}</p>
                        <p>Pontos: {Number(u.wallet?.points_balance ?? 0)}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {dateTimeBR(u.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!u.blocked}
                            onCheckedChange={(v) =>
                              mutateUser.mutate({ userId: u.id, blocked: !v })
                            }
                          />
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
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={u.isAdmin}
                          onCheckedChange={(v) =>
                            mutateUser.mutate({ userId: u.id, makeAdmin: v })
                          }
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setBalanceTarget({ id: u.id, name: u.full_name });
                              setBalanceOpen(true);
                            }}
                          >
                            Saldo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPlanTarget({ id: u.id, name: u.full_name });
                              setPlanOpen(true);
                            }}
                          >
                            Plano
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTarget({ id: u.id, name: u.full_name });
                              setOpen(true);
                            }}
                          >
                            Pontos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetPassword.mutate(u.email)}
                            disabled={resetPassword.isPending}
                          >
                            <KeyRound className="mr-2 size-3.5" /> Senha
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: u.id, name: u.full_name })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar pontos — {target?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="adj-points">Pontos (use negativo para debitar)</Label>
              <Input
                id="adj-points"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adj-reason">Motivo</Label>
              <Input
                id="adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: bônus promocional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => savePoints.mutate()}
              disabled={savePoints.isPending || !target || reason.trim().length < 3}
            >
              {savePoints.isPending ? "Salvando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar saldo — {balanceTarget?.name}</DialogTitle>
            <DialogDescription>
              Valores positivos creditam e negativos debitam. O ajuste aparece no extrato do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Carteira</Label>
              <Select value={wallet} onValueChange={setWallet}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(walletLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adj-amount">Valor</Label>
              <Input
                id="adj-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adj-bal-reason">Motivo</Label>
              <Input
                id="adj-bal-reason"
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="Ex.: correção de depósito"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveBalance.mutate()}
              disabled={
                saveBalance.isPending ||
                !balanceTarget ||
                balanceReason.trim().length < 3 ||
                Number(amount.replace(",", ".")) === 0 ||
                Number.isNaN(Number(amount.replace(",", ".")))
              }
            >
              {saveBalance.isPending ? "Salvando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar plano — {planTarget?.name}</DialogTitle>
            <DialogDescription>
              O plano é ativado imediatamente, sem cobrança. Nenhuma comissão de indicação é gerada
              — comissões sobem apenas em depósitos reais (PIX ou USDT).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {(plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {brl(Number(p.price))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-reason">Observação (opcional)</Label>
              <Input
                id="plan-reason"
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
                placeholder="Ex.: cortesia institucional"
              />
            </div>
            {selectedPlan ? (
              <p className="text-xs text-muted-foreground">
                Valor de referência: {brl(Number(selectedPlan.price))}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending || !planId}>
              {savePlan.isPending ? "Ativando..." : "Ativar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Esta ação remove permanentemente {deleteTarget?.name}, seus planos, saldos,
              transações e pedidos. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeUser.mutate()}
              disabled={removeUser.isPending}
            >
              {removeUser.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
