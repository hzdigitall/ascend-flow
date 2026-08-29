import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Clock, Coins, Loader2, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { purchasePlanWithBalance } from "@/lib/app.functions";
import { getMyActivePlans } from "@/lib/plans.functions";
import { createPlanCheckout } from "@/lib/plan-checkout.functions";
import { useUsdtRate } from "@/hooks/useUsdtRate";
import { brlToUsdt, fmtUsdt } from "@/lib/usdt";
import { Bitcoin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { brl, dateTimeBR, pts } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Arena Suplementos" },
      { name: "description", content: "Escolha seu plano Arena Suplementos, pague via PIX ou com saldo e acompanhe seus planos ativos." },
      { property: "og:title", content: "Planos — Arena Suplementos" },
      { property: "og:description", content: "Planos Arena Suplementos com pagamento PIX, compra com saldo e rendimento diário." },
    ],
  }),
  component: PlansPage,
});

const ROI_BY_PLAN: Record<string, number> = {
  Iniciante: 3.5,
  Intermediário: 4.5,
  Avançado: 6.5,
  Profissional: 6.5,
  Elite: 7.5,
};

const roiPct = (name: string) => ROI_BY_PLAN[name] ?? 0;

const fmtPct = (value: number) => `${value.toString().replace(".", ",")}%`;

type WalletKey = "main" | "earnings" | "referral";

function PlansPage() {
  const navigate = useNavigate();
  const { user, wallet, refresh } = useAuth();
  const startCheckout = useServerFn(createPlanCheckout);
  const usdtRate = useUsdtRate();
  const buyWithBalance = useServerFn(purchasePlanWithBalance);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [balancePlan, setBalancePlan] = useState<{ id: string; name: string; price: number } | null>(
    null,
  );
  const [sourceWallet, setSourceWallet] = useState<WalletKey>("referral");
  const [method, setMethod] = useState<"balance" | null>(null);
  const [buying, setBuying] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const fetchMyPlans = useServerFn(getMyActivePlans);

  const activeQuery = useQuery({
    queryKey: ["my-plans"],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const rows = await fetchMyPlans({ data: undefined });
      const now = Date.now();
      return (rows ?? [])
        .filter((p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now)
        .map((p: any) => {
          const price = Number(p.price);
          const earned = Number(p.earned_total ?? 0);
          const activatedAt = p.activated_at ? new Date(p.activated_at) : null;
          const lastCredit = p.last_earning_at ? new Date(p.last_earning_at) : null;
          const nextCredit = lastCredit
            ? new Date(lastCredit.getTime() + 86_400_000)
            : activatedAt
              ? new Date(activatedAt.getTime() + 86_400_000)
              : null;
          return {
            ...p,
            price,
            earned,
            target: price,
            progress: price > 0 ? Math.min(100, (earned / price) * 100) : 0,
            dailyAmount: (price * roiPct(p.plan_name)) / 100,
            nextCredit,
            firstCreditPending: !lastCredit,
          };
        })
        .filter((p: any) => p.earned < p.target);
    },
  });

  // Tempo real: qualquer mudança nos planos do usuário atualiza a lista na hora.
  const userId = user?.id;
  const refetchActive = activeQuery.refetch;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-plans-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_plans", filter: `user_id=eq.${userId}` },
        () => {
          refetchActive();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetchActive]);


  // Compra direta do plano: o pagamento é aplicado no plano, sem creditar saldo livre.
  const buy = async (planId: string, method: "pix" | "usdt") => {
    setPendingId(planId);
    try {
      const result = await startCheckout({ data: { planId, method } });
      navigate({ to: "/deposito/$depositId", params: { depositId: result.depositId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPendingId(null);
    }
  };

  const balances: Record<WalletKey, number> = {
    main: wallet?.main_balance ?? 0,
    earnings: wallet?.earnings_balance ?? 0,
    referral: wallet?.referral_balance ?? 0,
  };

  const confirmBalancePurchase = async () => {
    if (!balancePlan) return;
    if (balances[sourceWallet] < balancePlan.price) {
      toast.error("Saldo insuficiente nesta carteira.");
      return;
    }
    setBuying(true);
    try {
      await buyWithBalance({ data: { planId: balancePlan.id, wallet: sourceWallet } });
      toast.success(`Plano ${balancePlan.name} ativado com saldo!`);
      setBalancePlan(null);
      refresh();
      await activeQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a compra.");
    } finally {
      setBuying(false);
    }
  };

  return (
    <UserShell>
      <PageHeader
        title="Planos"
        description="Ative um plano para receber rendimentos diários e bônus de indicação. Limite de 4 planos ativos do mesmo tipo por usuário."
      />

      <Tabs defaultValue="disponiveis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="disponiveis">Adquirir</TabsTrigger>
          <TabsTrigger value="ativos">
            Planos ativos
            {activeQuery.data ? ` (${activeQuery.data.filter((p: any) => p.status === "active").length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-72 w-full rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhum plano disponível"
              description="Assim que novos planos forem publicados eles aparecerão aqui."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data!.map((plan, index) => {
                const blocked = Boolean(plan.purchase_blocked);
                return (
                  <Card
                    key={plan.id}
                    className={
                      index === 1
                        ? "relative overflow-hidden border-primary/40 shadow-card"
                        : "relative overflow-hidden shadow-card"
                    }
                  >
                    {blocked ? (
                      <div className="absolute inset-x-0 top-0 z-10 bg-destructive px-3 py-2 text-center text-xs font-semibold text-destructive-foreground">
                        Indisponível para aquisição no momento
                      </div>
                    ) : null}
                    {index === 1 && !blocked ? (
                      <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                        Mais popular
                      </span>
                    ) : null}
                    <CardContent
                      className={blocked ? "flex h-full flex-col p-6 pt-12" : "flex h-full flex-col p-6"}
                    >
                      <h2 className="text-lg font-bold">{plan.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                      <p className="mt-5 text-3xl font-extrabold tracking-tight">{brl(plan.price)}</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        <Badge variant="secondary" className="w-fit gap-1">
                          <Coins className="h-3.5 w-3.5" /> {pts(plan.points)} de bônus
                        </Badge>
                        <p className="text-xs font-semibold text-success">
                          Rendimento: {fmtPct(roiPct(plan.name))} ao dia
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Rendimentos em dias úteis até dobrar o valor investido · 1º rendimento 24h
                        após a ativação
                      </p>

                      <ul className="mt-5 flex-1 space-y-2">
                        {(plan.benefits ?? []).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            <span className="text-muted-foreground">{benefit}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="mt-6 w-full"
                        size="lg"
                        disabled={pendingId !== null || blocked}
                        onClick={() => {
                          const price = Number(plan.price);
                          setSourceWallet(
                            balances.referral >= price
                              ? "referral"
                              : balances.earnings >= price
                                ? "earnings"
                                : "main",
                          );
                          setMethod(null);
                          setBalancePlan({ id: plan.id, name: plan.name, price });
                        }}
                      >
                        {pendingId === plan.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {blocked ? "Indisponível para aquisição no momento" : "Adquirir plano"}
                      </Button>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ativos" className="space-y-4">
          {activeQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : activeQuery.isError ? (
            <ErrorState onRetry={() => activeQuery.refetch()} />
          ) : (activeQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhum plano ativo"
              description="Adquira um plano para começar a receber rendimentos diários."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeQuery.data!.map((p: any) => (
                <Card key={p.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">{p.plan_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {brl(p.price)} · {fmtPct(roiPct(p.plan_name))} ao dia
                        </p>
                      </div>
                      <Badge variant="secondary">Ativo</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Rendimento diário</p>
                        <p className="font-semibold text-success">{brl(p.dailyAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rendimento acumulado</p>
                        <p className="font-semibold">
                          {brl(p.earned)} / {brl(p.target)}
                        </p>
                      </div>
                    </div>

                    <Progress value={p.progress} className="mt-4" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.floor(p.progress)}% do ciclo concluído
                    </p>

                    <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                      <p>Ativado em: {p.activated_at ? dateTimeBR(p.activated_at) : "—"}</p>
                      {p.status === "active" && p.nextCredit ? (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {p.firstCreditPending
                            ? `1º rendimento (24h após a ativação): ${dateTimeBR(p.nextCredit.toISOString())}`
                            : `Próximo rendimento: ${dateTimeBR(p.nextCredit.toISOString())}`}
                        </p>
                      ) : null}
                      <p>
                        Rendimentos creditados em dias úteis. Somente a rentabilidade fica disponível
                        para saque; o valor do plano permanece investido até o fim do ciclo.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={balancePlan !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBalancePlan(null);
            setMethod(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adquirir plano</DialogTitle>
            <DialogDescription>
              {balancePlan
                ? `Plano ${balancePlan.name} · ${brl(balancePlan.price)}. Escolha a forma de pagamento.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {method === "balance" ? (
            <div className="space-y-3">
              <Select value={sourceWallet} onValueChange={(v) => setSourceWallet(v as WalletKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a carteira" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="referral">
                    Bônus de indicação ({brl(balances.referral)})
                  </SelectItem>
                  <SelectItem value="earnings">Rendimentos ({brl(balances.earnings)})</SelectItem>
                  <SelectItem value="main">Saldo principal ({brl(balances.main)})</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O valor é debitado na hora e o plano é ativado imediatamente. O primeiro rendimento é
                creditado 24h após a ativação.
              </p>
              <Button className="w-full" size="lg" onClick={confirmBalancePurchase} disabled={buying}>
                {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar compra
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMethod(null)}>
                Voltar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                disabled={pendingId !== null}
                onClick={() => balancePlan && void buy(balancePlan.id, "pix")}
              >
                {pendingId !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pagar com PIX
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                disabled={pendingId !== null}
                onClick={() => balancePlan && void buy(balancePlan.id, "usdt")}
              >
                <Bitcoin className="mr-2 h-4 w-4" /> Pagar com USDT
                {balancePlan
                  ? ` (${fmtUsdt(brlToUsdt(balancePlan.price, usdtRate))})`
                  : ""}
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => setMethod("balance")}
              >
                <Wallet className="mr-2 h-4 w-4" /> Comprar com saldo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </UserShell>
  );
}
