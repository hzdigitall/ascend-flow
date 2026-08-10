import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Coins,
  Copy,
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Meu painel — Nexora" },
      { name: "description", content: "Resumo dos seus saldos, pontos, plano ativo e indicações." },
      { property: "og:title", content: "Meu painel — Nexora" },
      { property: "og:description", content: "Acompanhe saldos, pontos e indicações." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, wallet } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const [planRes, txRes, refRes, bannerRes] = await Promise.all([
        supabase
          .from("user_plans")
          .select("*, plans(name, points_reward)")
          .eq("user_id", profile!.id)
          .eq("status", "active")
          .order("activated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("wallet_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("referrals").select("id, level").eq("sponsor_id", profile!.id),
        supabase
          .from("banners")
          .select("*")
          .eq("active", true)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        plan: planRes.data,
        transactions: txRes.data ?? [],
        referrals: refRes.data ?? [],
        banner: bannerRes.data,
      };
    },
  });

  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/cadastro?ref=${profile.referral_code}`
      : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success("Link de indicação copiado!");
  };

  const directs = (data?.referrals ?? []).filter((r) => r.level === 1).length;

  return (
    <UserShell>
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] ?? "bem-vindo"}!`}
        description="Este é o resumo da sua conta hoje."
        action={
          <Button asChild>
            <Link to="/planos">
              <Sparkles className="mr-2 h-4 w-4" /> Ver planos
            </Link>
          </Button>
        }
      />

      {data?.banner ? (
        <Card className="overflow-hidden border-0 bg-gradient-brand text-primary-foreground shadow-card">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{data.banner.title}</h2>
              {data.banner.subtitle ? (
                <p className="mt-1 text-sm text-primary-foreground/85">{data.banner.subtitle}</p>
              ) : null}
            </div>
            {data.banner.link_url ? (
              <Button asChild variant="secondary" className="shrink-0">
                <a href={data.banner.link_url}>Saiba mais</a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo principal"
          value={brl(wallet?.main_balance)}
          icon={Wallet}
          loading={!wallet}
        />
        <StatCard
          label="Ganhos"
          value={brl(wallet?.earnings_balance)}
          icon={TrendingUp}
          tone="success"
          loading={!wallet}
        />
        <StatCard
          label="Comissões de indicação"
          value={brl(wallet?.referral_balance)}
          icon={Users}
          tone="purple"
          loading={!wallet}
        />
        <StatCard
          label="Pontos"
          value={pts(wallet?.points_balance)}
          icon={Coins}
          hint="Use na loja de prêmios"
          loading={!wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Movimentações recentes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/carteira">
                Ver tudo <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : (data?.transactions.length ?? 0) === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhuma movimentação ainda"
                description="Ative um plano ou indique amigos para começar a movimentar sua carteira."
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
                        tx.direction === "credit"
                          ? "shrink-0 text-sm font-semibold text-success"
                          : "shrink-0 text-sm font-semibold text-destructive"
                      }
                    >
                      {tx.direction === "credit" ? "+" : "-"}
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
              <CardTitle className="text-base">Plano atual</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.plan ? (
                <div className="space-y-2">
                  <p className="text-lg font-bold">{data.plan.plans?.name}</p>
                  <StatusBadge status={data.plan.status} />
                  <p className="text-xs text-muted-foreground">
                    Ativado em {dateBR(data.plan.activated_at)}
                    {data.plan.expires_at ? ` · expira em ${dateBR(data.plan.expires_at)}` : ""}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Você ainda não tem um plano ativo.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/planos">Escolher plano</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Seu link de indicação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {directs} indicado{directs === 1 ? "" : "s"} direto{directs === 1 ? "" : "s"}
              </p>
              <div className="rounded-xl bg-muted p-3">
                <p className="break-all text-xs text-muted-foreground">{referralLink || "—"}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink} className="flex-1" disabled={!referralLink}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar
                </Button>
                <Button asChild variant="outline">
                  <Link to="/indicacoes">Rede</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </UserShell>
  );
}
