import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNetworkAmount } from "@/lib/network.functions";
import {
  ArrowUpRight,
  Banknote,
  Coins,
  Copy,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, StatCard, EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, dateBR, dateTimeBR, pts } from "@/lib/format";
import { referralLink as buildReferralLink } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Meu painel — Arena Suplementos" },
      { name: "description", content: "Resumo dos seus saldos, pontos, plano ativo e indicações na Arena Suplementos." },
      { property: "og:title", content: "Meu painel — Arena Suplementos" },
      { property: "og:description", content: "Acompanhe saldos, pontos e indicações na Arena Suplementos." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, wallet } = useAuth();
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const [planRes, txRes, refRes, bannerRes] = await Promise.all([
        supabase
          .from("user_plans")
          .select("*, plans(name, points)")
          .eq("user_id", profile!.id)
          .eq("status", "active")
          .order("activated_at", { ascending: false }),
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", profile!.id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("referrals").select("id, level").eq("sponsor_id", profile!.id),
        supabase
          .from("banners")
          .select("*")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const activePlans = planRes.data ?? [];

      // Total já rendido por plano ativo
      const roiByPlan: Record<string, number> = {};
      if (activePlans.length > 0) {
        const { data: roiData } = await supabase
          .from("wallet_transactions")
          .select("amount, reference_id")
          .eq("user_id", profile!.id)
          .eq("category", "earning")
          .in(
            "reference_id",
            activePlans.map((p) => p.id),
          );

        for (const row of roiData ?? []) {
          if (!row.reference_id) continue;
          roiByPlan[row.reference_id] = (roiByPlan[row.reference_id] ?? 0) + Number(row.amount);
        }
      }

      return {
        plans: activePlans,
        transactions: txRes.data ?? [],
        referrals: refRes.data ?? [],
        banner: bannerRes.data,
        roiByPlan,
      };
    },
  });


  const fetchNetwork = useServerFn(getNetworkAmount);
  const { data: net, isLoading: netLoading } = useQuery({
    queryKey: ["dashboard", "network", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => fetchNetwork(),
  });

  const refLink = profile?.referral_code ? buildReferralLink(profile.referral_code) : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(refLink);
    toast.success(t("dash.copied"));
  };

  const directs = (data?.referrals ?? []).filter((r) => r.level === 1).length;


  // O bônus de cadastro (R$ 30) já é creditado no saldo principal no cadastro,
  // então aqui entram apenas os preços dos planos (bloqueados até o vencimento).
  const investedLocked = (data?.plans ?? []).reduce((sum, p) => sum + Number(p.price ?? 0), 0);
  const investedTotal = investedLocked;
  const withdrawable =
    Number(wallet?.earnings_balance ?? 0) + Number(wallet?.referral_balance ?? 0);

  return (
    <UserShell>
      <PageHeader
        title={t("dash.hello", { name: profile?.full_name?.split(" ")[0] ?? t("dash.welcome") })}
        description={t("dash.subtitle")}
        action={
          <Button asChild>
            <Link to="/planos">
              <Sparkles className="mr-2 h-4 w-4" /> {t("dash.seePlans")}
            </Link>
          </Button>
        }
      />

      {data?.banner ? (
        <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-card">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{data.banner.title}</h2>
              {data.banner.subtitle ? (
                <p className="mt-1 text-sm text-white/85">{data.banner.subtitle}</p>
              ) : null}
            </div>
            {data.banner.button_url ? (
              <Button asChild variant="secondary" className="shrink-0">
                <a href={data.banner.button_url}>{data.banner.button_label ?? t("dash.knowMore")}</a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
<StatCard
          label={t("dash.balance.main")}
          value={brl(Number(wallet?.main_balance ?? 0) + investedLocked)}
          icon={Wallet}
          hint={`Saldo anterior + ${brl(investedLocked)} de montante investido (bloqueado até o vencimento do plano).`}
          loading={!wallet}
        />
        <StatCard
          label={t("dash.balance.earnings")}
          value={brl(wallet?.earnings_balance)}
          icon={TrendingUp}
          tone="success"
          loading={!wallet}
        />
        <StatCard
          label={t("dash.balance.referral")}
          value={brl(wallet?.referral_balance)}
          icon={Users}
          tone="secondary"
          loading={!wallet}
        />
        <StatCard
          label={t("dash.balance.points")}
          value={pts(wallet?.points_balance)}
          icon={Coins}
          hint={t("dash.points.hint")}
          loading={!wallet}
        />
        <StatCard
          label="Montante investido"
          value={brl(investedTotal)}
          icon={Lock}
          hint="Valor dos planos ativos. Liberado no saldo principal quando o plano vencer."
          loading={isLoading}
        />
        <StatCard
          label="Disponível para saque"
          value={brl(withdrawable)}
          icon={Banknote}
          tone="success"
          hint="Rendimentos e comissões já liberados."
          loading={!wallet}
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Montante da rede</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Pessoas na rede</p>
              <p className="text-xl font-bold">{net?.members ?? 0}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Montante investido pela rede</p>
              <p className="text-xl font-bold">{brl(net?.totalInvested ?? 0)}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Rendimento da rede</p>
              <p className="text-xl font-bold text-success">{brl(net?.totalEarned ?? 0)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Suas comissões: {brl(net?.myCommissions ?? 0)}
              </p>
            </div>
          </div>

          {netLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (net?.byLevel.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="Sua rede ainda está vazia"
              description="Compartilhe seu link de indicação para começar a montar sua rede."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Nível</th>
                    <th className="py-2 pr-3 font-medium">Pessoas</th>
                    <th className="py-2 pr-3 font-medium">Montante</th>
                    <th className="py-2 font-medium">Rendendo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {net!.byLevel.map((row) => (
                    <tr key={row.level}>
                      <td className="py-2 pr-3 font-medium">Nível {row.level}</td>
                      <td className="py-2 pr-3">{row.members}</td>
                      <td className="py-2 pr-3">{brl(row.invested)}</td>
                      <td className="py-2 text-success">{brl(row.earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("dash.recent")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/carteira">
                {t("common.seeAll")} <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : (data?.transactions.length ?? 0) === 0 ? (
              <EmptyState
                icon={Wallet}
                title={t("dash.empty.title")}
                description={t("dash.empty.text")}
              />
            ) : (
              <ul className="divide-y">
                {data!.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.description ?? tx.category}</p>
                      <p className="text-xs text-muted-foreground">{dateTimeBR(tx.created_at)}</p>
                    </div>
                    <span
                      className={
                        tx.direction === "in"
                          ? "shrink-0 text-sm font-semibold text-success"
                          : "shrink-0 text-sm font-semibold text-destructive"
                      }
                    >
                      {tx.direction === "in" ? "+" : "-"}
                      {brl(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">
                {t("dash.currentPlan")}
                {(data?.plans.length ?? 0) > 1 ? ` (${data!.plans.length})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.plans.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {data!.plans.map((plan) => {
                    const earned = data!.roiByPlan[plan.id] ?? 0;
                    const cap = Number(plan.price) * 2;
                    const pct = cap > 0 ? (earned / cap) * 100 : 0;
                    return (
                      <div key={plan.id} className="space-y-3 rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-base font-bold">
                            {plan.plans?.name ?? plan.plan_name}
                          </p>
                          <StatusBadge status={plan.status} />
                        </div>

                        <div className="rounded-lg bg-muted/60 p-2">
                          <p className="text-sm font-semibold">{brl(plan.price)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Montante do plano (somado ao saldo principal)
                          </p>
                        </div>


                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("dash.roiProgress")}</span>
                            <span className="font-medium">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {t("dash.roiCap", { earned: brl(earned), cap: brl(cap) })}
                          </p>
                        </div>

                        <p className="text-[10px] text-muted-foreground">
                          {t("dash.activatedAt", { date: dateBR(plan.activated_at) })}
                          {plan.expires_at ? t("dash.expiresAt", { date: dateBR(plan.expires_at) }) : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("dash.noPlan")}
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/planos">{t("dash.choosePlan")}</Link>
                  </Button>
                </div>
              )}
            </CardContent>

          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{t("dash.refLink")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("dash.directs", { count: directs })}
              </p>
              <div className="rounded-xl bg-muted p-3">
                <p className="break-all text-xs text-muted-foreground">{refLink || "—"}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink} className="flex-1" disabled={!refLink}>
                  <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/indicacoes">{t("dash.network")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </UserShell>
  );
}
