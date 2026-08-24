import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, ErrorState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, dateTimeBR } from "@/lib/format";
import { refreshDepositStatus } from "@/lib/deposits.functions";

export const Route = createFileRoute("/_authenticated/deposito/$depositId")({
  head: () => ({
    meta: [
      { title: "Depósito — Arena Saúde" },
      {
        name: "description",
        content: "Acompanhe a confirmação do seu depósito PIX ou USDT BEP20 na Arena Saúde.",
      },
      { property: "og:title", content: "Depósito — Arena Saúde" },
      {
        property: "og:description",
        content: "Acompanhe a confirmação do seu depósito PIX ou USDT BEP20 na Arena Saúde.",
      },
    ],
  }),
  component: DepositDetailPage,
});

function copy(value: string, label: string) {
  void navigator.clipboard.writeText(value);
  toast.success(`${label} copiado`);
}

function DepositDetailPage() {
  const { depositId } = Route.useParams();
  const refreshFn = useServerFn(refreshDepositStatus);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["deposit", depositId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .eq("id", depositId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) =>
      query.state.data && (query.state.data as { credited_at: string | null }).credited_at
        ? false
        : 10_000,
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn({ data: { depositId } }),
    onSuccess: () => void refetch(),
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <UserShell>
        <Skeleton className="h-72 w-full" />
      </UserShell>
    );
  }

  if (isError || !data) {
    return (
      <UserShell>
        <ErrorState onRetry={() => refetch()} />
      </UserShell>
    );
  }

  const isUsdt = data.currency === "USDT";
  const credited = Boolean(data.credited_at);
  const failed = data.status === "failed" || data.status === "expired";
  const amountLabel = isUsdt ? `${Number(data.amount).toFixed(2)} USDT` : brl(Number(data.amount));

  return (
    <UserShell>
      <PageHeader
        title={isUsdt ? "Depósito USDT (BEP20)" : "Depósito PIX"}
        description={`Valor solicitado: ${amountLabel}`}
        action={
          <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className="h-4 w-4" /> Atualizar status
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {credited ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : failed ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-primary" />
              )}
              {credited
                ? "Depósito confirmado e creditado"
                : failed
                  ? "Depósito não concluído"
                  : "Aguardando confirmação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {credited ? (
              <Alert>
                <AlertDescription>
                  Seu saldo já foi atualizado. Confira em Carteira.
                </AlertDescription>
              </Alert>
            ) : failed ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {data.failure_reason ?? "Este depósito expirou ou não foi concluído."}
                </AlertDescription>
              </Alert>
            ) : isUsdt ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Envie exclusivamente <strong>USDT na rede BEP20</strong> para o endereço abaixo.
                    Outros ativos ou redes não são creditados.
                  </AlertDescription>
                </Alert>
                {data.crypto_address ? (
                  <>
                    <div className="flex justify-center rounded-xl border bg-white p-4">
                      <QRCodeCanvas value={data.crypto_address} size={180} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Endereço BEP20</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded bg-muted px-2 py-2 text-xs">
                          {data.crypto_address}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(data.crypto_address!, "Endereço")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Endereço em geração. Atualize o status em alguns instantes.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {data.pix_qr_code ? (
                  <div className="flex justify-center rounded-xl border bg-white p-4">
                    <img
                      src={
                        data.pix_qr_code.startsWith("data:")
                          ? data.pix_qr_code
                          : `data:image/png;base64,${data.pix_qr_code}`
                      }
                      alt="QR Code PIX do depósito"
                      className="h-44 w-44 object-contain"
                    />
                  </div>
                ) : data.pix_copy_paste ? (
                  <div className="flex justify-center rounded-xl border bg-white p-4">
                    <QRCodeCanvas value={data.pix_copy_paste} size={180} />
                  </div>
                ) : null}

                {data.pix_copy_paste ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">PIX copia e cola</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-muted px-2 py-2 text-xs">
                        {data.pix_copy_paste}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(data.pix_copy_paste!, "Código PIX")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Cobrança em processamento. Atualize o status em alguns instantes.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={credited ? "paid" : data.status} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold">{amountLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Método</span>
              <span className="font-medium uppercase">
                {isUsdt ? `USDT ${data.network ?? "BEP20"}` : "PIX"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Criado em</span>
              <span>{dateTimeBR(data.created_at)}</span>
            </div>
            {data.expires_at ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Expira em</span>
                <span>{dateTimeBR(data.expires_at)}</span>
              </div>
            ) : null}
            {data.tx_hash ? (
              <div className="space-y-1">
                <span className="text-muted-foreground">Hash</span>
                <p className="break-all text-xs">{data.tx_hash}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </UserShell>
  );
}
