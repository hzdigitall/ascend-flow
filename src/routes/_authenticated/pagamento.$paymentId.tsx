import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Clock, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pagamento/$paymentId")({
  head: () => ({
    meta: [
      { title: "Pagamento PIX — Nexora" },
      { name: "description", content: "Finalize o pagamento PIX para ativar seu plano." },
      { property: "og:title", content: "Pagamento PIX — Nexora" },
      { property: "og:description", content: "Conclua o pagamento e ative seu plano." },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { paymentId } = Route.useParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payment", paymentId],
    refetchInterval: (query) =>
      (query.state.data as { status?: string } | undefined)?.status === "paid" ? false : 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, plans(name)")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Código PIX copiado!");
  };

  return (
    <UserShell>
      <PageHeader
        title="Pagamento via PIX"
        description="Após a confirmação do pagamento seu plano é ativado automaticamente."
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : isError || !data ? (
        <ErrorState message="Cobrança não encontrada." onRetry={() => refetch()} />
      ) : data.status === "paid" ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/12 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold">Pagamento confirmado!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu plano foi ativado e os pontos já estão na sua conta.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/dashboard">Ir para o painel</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/loja">Ver loja de prêmios</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Valor a pagar</p>
                  <p className="text-3xl font-extrabold tracking-tight">{brl(data.amount)}</p>
                </div>
                <StatusBadge status={data.status} />
              </div>

              {data.pix_qr_code ? (
                <div className="mt-6 flex justify-center rounded-xl border bg-card p-4">
                  <img
                    src={data.pix_qr_code}
                    alt="QR Code do pagamento PIX"
                    className="h-56 w-56 object-contain"
                  />
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    O QR Code ainda não foi gerado. Assim que o gateway PIX estiver configurado pelo
                    administrador, ele aparecerá aqui automaticamente.
                  </p>
                </div>
              )}

              {data.pix_copy_paste ? (
                <div className="mt-6 space-y-2">
                  <p className="text-sm font-medium">PIX copia e cola</p>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="break-all text-xs text-muted-foreground">{data.pix_copy_paste}</p>
                  </div>
                  <Button className="w-full" onClick={() => copy(data.pix_copy_paste!)}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar código
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit shadow-card">
            <CardContent className="space-y-4 p-6 text-sm">
              <div>
                <p className="text-muted-foreground">Plano</p>
                <p className="font-semibold">{data.plans?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Criado em</p>
                <p className="font-medium">{dateTimeBR(data.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expira em</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {dateTimeBR(data.expires_at)}
                </p>
              </div>
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Esta página atualiza sozinha assim que o pagamento for confirmado.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </UserShell>
  );
}
