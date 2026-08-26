import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, PlugZap, RefreshCw, ShieldCheck, X } from "lucide-react";
import {
  getGatewayOverview,
  saveGatewayCredential,
  setGatewayActive,
  setGatewayFeatures,
  testGatewayConnection,
} from "@/lib/gateway.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, ErrorState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/gateways")({
  head: () => ({
    meta: [
      { title: "Gateways de pagamento — Arena Saúde" },
      {
        name: "description",
        content: "Configure, teste e ative a ConnectPay (PIX e USDT BEP20).",
      },
    ],
  }),
  component: GatewaysPage,
});

const STATUS_LABEL: Record<string, string> = {
  not_configured: "Não configurada",
  connected: "Conectada",
  unauthorized: "Credencial inválida",
  error: "Erro de conexão",
};

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("URL copiada");
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
      </div>
    </div>
  );
}

function GatewaysPage() {
  const overviewFn = useServerFn(getGatewayOverview);
  const saveFn = useServerFn(saveGatewayCredential);
  const testFn = useServerFn(testGatewayConnection);
  const activeFn = useServerFn(setGatewayActive);
  const featuresFn = useServerFn(setGatewayFeatures);

  const [secret, setSecret] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "gateways", "connectpay"],
    queryFn: () => overviewFn({ data: undefined as never }),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { apiSecret: secret.trim() } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setSecret("");
      } else {
        toast.error(res.message);
      }
      void refetch();
    },
    onError: () => toast.error("Não foi possível salvar a credencial."),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: undefined as never }),
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      void refetch();
    },
    onError: () => toast.error("Falha ao testar a conexão."),
  });

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => activeFn({ data: { active } }),
    onSuccess: (res) => {
      toast.success(res.active ? "ConnectPay ativada." : "ConnectPay desativada.");
      setConfirmOpen(false);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleFeature = useMutation({
    mutationFn: (patch: Record<string, boolean>) => featuresFn({ data: patch }),
    onSuccess: () => void refetch(),
    onError: () => toast.error("Não foi possível atualizar os recursos."),
  });

  const g = data?.gateway ?? null;
  const canActivate = Boolean(g?.credentials_configured && g?.connection_status === "connected");

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Gateways de pagamento"
        description="ConnectPay processa exclusivamente PIX (BRL). NOWPayments processa exclusivamente USDT BEP20 (USDTBSC)."
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]" id="connectpay">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="h-5 w-5 text-primary" /> ConnectPay
              </CardTitle>
              <span
                className={
                  g?.active
                    ? "rounded-full bg-success/12 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-success"
                    : "rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                }
              >
                {g?.active ? "Ativa" : "Inativa"}
              </span>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Credencial configurada</dt>
                  <dd className="font-medium">
                    {g?.credentials_configured ? (data?.masked ?? "Sim") : "Não"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status da conexão</dt>
                  <dd className="font-medium">
                    {STATUS_LABEL[g?.connection_status ?? "not_configured"]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Ambiente</dt>
                  <dd className="font-medium uppercase">{g?.environment ?? "production"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Base URL</dt>
                  <dd className="font-mono text-xs">{g?.base_url}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Último teste de conexão</dt>
                  <dd className="font-medium">
                    {g?.last_connection_test ? dateTimeBR(g.last_connection_test) : "—"}
                  </dd>
                </div>
                {g?.last_error ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Último erro</dt>
                    <dd className="text-xs text-destructive">{g.last_error}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-3 rounded-lg border p-3">
                {(
                  [
                    ["pix_cashin_enabled", "PIX Cash-in"],
                    ["pix_cashout_enabled", "PIX Cash-out"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={key} className="text-sm">
                      {label}
                    </Label>
                    <Switch
                      id={key}
                      checked={Boolean(g?.[key])}
                      onCheckedChange={(checked) => toggleFeature.mutate({ [key]: checked })}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => test.mutate()}
                  disabled={test.isPending || !g?.credentials_configured}
                >
                  <RefreshCw className="h-4 w-4" /> Testar conexão
                </Button>
                {g?.active ? (
                  <Button
                    variant="destructive"
                    onClick={() => toggleActive.mutate(false)}
                    disabled={toggleActive.isPending}
                  >
                    <X className="h-4 w-4" /> Desativar
                  </Button>
                ) : (
                  <Button onClick={() => setConfirmOpen(true)} disabled={!canActivate}>
                    <Check className="h-4 w-4" /> Ativar ConnectPay
                  </Button>
                )}
              </div>
              {!canActivate && !g?.active ? (
                <p className="text-xs text-muted-foreground">
                  A ativação só é liberada com credencial cadastrada e conexão bem-sucedida.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {g?.credentials_configured ? "Alterar credencial" : "Configurar ConnectPay"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Ambiente de produção</AlertTitle>
                  <AlertDescription>
                    A ConnectPay opera em ambiente de produção. Após a ativação, as operações
                    poderão movimentar valores reais.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    autoComplete="off"
                    placeholder="Cole aqui seu API Secret da ConnectPay"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A credencial é criptografada no servidor e nunca é exibida novamente. A chave
                    anterior só é substituída se a nova passar no teste de conexão.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ambiente</Label>
                    <Input value="PRODUÇÃO" readOnly />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Base URL</Label>
                    <Input value={g?.base_url ?? "https://api.connectpay.vc"} readOnly />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => save.mutate()}
                  disabled={save.isPending || secret.trim().length < 8}
                >
                  Salvar e testar conexão
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">URLs de webhook</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyField label="Webhook PIX Cash-in" value={data?.webhooks.pixCashIn ?? ""} />
                <CopyField label="Webhook PIX Cash-out" value={data?.webhooks.pixCashOut ?? ""} />
                <p className="text-xs text-muted-foreground">
                  Essas URLs são utilizadas automaticamente na criação das transações PIX. As
                  operações em USDT são processadas pela NOWPayments.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4" id="nowpayments">
        <h2 className="text-lg font-semibold">NOWPayments — USDT BEP20</h2>
        <NowPaymentsCard />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar ConnectPay em produção?</DialogTitle>
            <DialogDescription>
              Após a ativação, o sistema poderá gerar cobranças e processar transações financeiras
              reais.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => toggleActive.mutate(true)} disabled={toggleActive.isPending}>
              Confirmar ativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
