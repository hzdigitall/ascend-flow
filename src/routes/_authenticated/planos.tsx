import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Coins, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPlanPayment } from "@/lib/app.functions";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { brl, pts } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Arena Saúde" },
      { name: "description", content: "Escolha seu plano Arena Saúde, pague via PIX e receba os pontos na hora." },
      { property: "og:title", content: "Planos — Arena Saúde" },
      { property: "og:description", content: "Planos Arena Saúde com pagamento PIX e pontos de bônus." },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const createPayment = useServerFn(createPlanPayment);
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  const buy = async (planId: string) => {
    setPendingId(planId);
    try {
      const result = await createPayment({ data: { planId } });
      if (result.message) toast.info(result.message);
      navigate({ to: "/pagamento/$paymentId", params: { paymentId: result.paymentId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <UserShell>
      <PageHeader
        title="Planos"
        description="Ative um plano para receber rendimentos diários e bônus de indicação. Limite de 4 planos ativos do mesmo tipo por usuário."
      />

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
              <CardContent className={blocked ? "flex h-full flex-col p-6 pt-12" : "flex h-full flex-col p-6"}>
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                <p className="mt-5 text-3xl font-extrabold tracking-tight">{brl(plan.price)}</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Badge variant="secondary" className="w-fit gap-1">
                    <Coins className="h-3.5 w-3.5" /> {pts(plan.points)} de bônus
                  </Badge>
                  <p className="text-xs font-semibold text-success">
                    Rendimento: {
                      plan.name === 'Iniciante' ? '3,5%' :
                      plan.name === 'Intermediário' ? '4,5%' :
                      plan.name === 'Avançado' ? '6,5%' :
                      plan.name === 'Profissional' ? '6,5%' :
                      plan.name === 'Elite' ? '7,5%' : '0%'
                    } ao dia
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Validade de {plan.validity_days} dias · Limite 200% ROI
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
                  onClick={() => buy(plan.id)}
                  disabled={pendingId !== null || blocked}
                >
                  {pendingId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {blocked ? "Indisponível para aquisição no momento" : "Pagar com PIX"}
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </UserShell>
  );
}
