import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bitcoin, Check, Copy, RefreshCw, ShieldCheck, X, Wallet } from "lucide-react";
import {
  getNowPaymentsOverview,
  refreshNowPaymentsBalance,
  saveNowPaymentsCredentials,
  setNowPaymentsActive,
  setNowPaymentsFeatures,
  testNowPaymentsConnection,
} from "@/lib/nowpayments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { dateTimeBR } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  not_configured: "Não configurada",
  connected: "Conectada",
  unauthorized: "Credencial inválida",
  error: "Erro de conexão",
};

function Copyable({ label, value }: { label: string; value: string }) {
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

export function NowPaymentsCard() {
  const overviewFn = useServerFn(getNowPaymentsOverview);
  const saveFn = useServerFn(saveNowPaymentsCredentials);
  const testFn = useServerFn(testNowPaymentsConnection);
  const balanceFn = useServerFn(refreshNowPaymentsBalance);
  const activeFn = useServerFn(setNowPaymentsActive);
  const featuresFn = useServerFn(setNowPaymentsFeatures);

  const [apiKey, setApiKey] = useState("");
  const [ipnSecret, setIpnSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "gateways", "nowpayments"],
    queryFn: () => overviewFn({ data: undefined as never }),
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(ipnSecret.trim() ? { ipnSecret: ipnSecret.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(password ? { password } : {}),
          ...(totpSecret.trim() ? { totpSecret: totpSecret.trim() } : {}),
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setApiKey("");
        setIpnSecret("");
        setEmail("");
        setPassword("");
        setTotpSecret("");
      } else {
        toast.error(res.message);
      }
      void refetch();
    },
    onError: () => toast.error("Não foi possível salvar as credenciais."),
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

  const balance = useMutation({
    mutationFn: () => balanceFn({ data: undefined as never }),
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      void refetch();
    },
    onError: () => toast.error("Falha ao consultar o saldo."),
  });

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => activeFn({ data: { active } }),
    onSuccess: (res) => {
      toast.success(res.active ? "NOWPayments ativada." : "NOWPayments desativada.");
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleFeature = useMutation({
    mutationFn: (patch: { usdt_deposit_enabled?: boolean; usdt_withdraw_enabled?: boolean }) =>
      featuresFn({ data: patch }),
    onSuccess: () => void refetch(),
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const g = data?.gateway ?? null;
  const configured = data?.configured ?? {};
  const snapshot = (g?.balance_snapshot ?? {}) as Record<string, unknown>;
  const canActivate = Boolean(
    g?.credentials_configured && g?.ipn_configured && g?.connection_status === "connected" && g?.asset_available,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5 text-primary" /> NOWPayments — USDT {data?.network}
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
              <dt className="text-xs text-muted-foreground">Status da conexão</dt>
              <dd className="font-medium">
                {STATUS_LABEL[g?.connection_status ?? "not_configured"]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Moeda / rede</dt>
              <dd className="font-medium">
                {data?.ticker} · {data?.network}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">API Key</dt>
              <dd className="font-medium">{configured["api_key"]?.masked ?? "Não configurada"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">IPN Secret</dt>
              <dd className="font-medium">
                {configured["ipn_secret"]?.masked ?? "Não configurado"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Autenticação de payout</dt>
              <dd className="font-medium">
                {g?.payout_auth_configured ? "Configurada" : "Não configurada"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">2FA (TOTP) de payout</dt>
              <dd className="font-medium">{g?.totp_configured ? "Configurado" : "Não configurado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">USDTBSC disponível na conta</dt>
              <dd className="font-medium">{g?.asset_available ? "Sim" : "Não"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Último teste de conexão</dt>
              <dd className="font-medium">
                {g?.last_connection_test ? dateTimeBR(g.last_connection_test) : "—"}
              </dd>
            </div>
            {g?.last_error ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Último erro</dt>
                <dd className="text-xs text-destructive">{g.last_error}</dd>
              </div>
            ) : null}
          </dl>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="np_deposit" className="text-sm">
                Depósito USDT ({data?.ticker})
              </Label>
              <Switch
                id="np_deposit"
                checked={Boolean(g?.usdt_deposit_enabled)}
                onCheckedChange={(checked) =>
                  toggleFeature.mutate({ usdt_deposit_enabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="np_withdraw" className="text-sm">
                Saque USDT ({data?.ticker})
              </Label>
              <Switch
                id="np_withdraw"
                checked={Boolean(g?.usdt_withdraw_enabled)}
                onCheckedChange={(checked) =>
                  toggleFeature.mutate({ usdt_withdraw_enabled: checked })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Saldo na NOWPayments
            </p>
            <pre className="mt-2 max-h-40 overflow-auto text-xs">
              {Object.keys(snapshot).length > 0 ? JSON.stringify(snapshot, null, 2) : "—"}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              <RefreshCw className="h-4 w-4" /> Testar conexão
            </Button>
            <Button
              variant="outline"
              onClick={() => balance.mutate()}
              disabled={balance.isPending || !g?.credentials_configured}
            >
              <Wallet className="h-4 w-4" /> Atualizar saldo
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
              <Button onClick={() => toggleActive.mutate(true)} disabled={!canActivate}>
                <Check className="h-4 w-4" /> Ativar NOWPayments
              </Button>
            )}
          </div>
          {!canActivate && !g?.active ? (
            <p className="text-xs text-muted-foreground">
              A ativação exige API Key, IPN Secret, teste de conexão bem-sucedido e USDTBSC
              disponível na conta.
            </p>
          ) : null}
          {!data?.payoutReady ? (
            <p className="text-xs text-muted-foreground">
              Saques automáticos exigem também e-mail/senha de payout configurados.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Credenciais NOWPayments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ambiente de produção</AlertTitle>
              <AlertDescription>
                As credenciais são criptografadas no servidor e nunca são exibidas novamente. Após a
                ativação, as operações movimentam valores reais em {data?.ticker}.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="np_api_key">API Key</Label>
              <Input
                id="np_api_key"
                type="password"
                autoComplete="off"
                placeholder="Cole a API Key da NOWPayments"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np_ipn">IPN Secret</Label>
              <Input
                id="np_ipn"
                type="password"
                autoComplete="off"
                placeholder="Cole o IPN Secret"
                value={ipnSecret}
                onChange={(e) => setIpnSecret(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np_email">E-mail da conta (payout)</Label>
              <Input
                id="np_email"
                type="email"
                autoComplete="off"
                placeholder="conta@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np_password">Senha da conta (payout)</Label>
              <Input
                id="np_password"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np_totp">Segredo 2FA (TOTP) — opcional</Label>
              <Input
                id="np_totp"
                type="password"
                autoComplete="off"
                placeholder="Base32 do 2FA usado na verificação de payout"
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !(apiKey.trim() || ipnSecret.trim() || email.trim() || password || totpSecret.trim())
              }
            >
              Salvar credenciais
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Webhooks (IPN)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Copyable label="Pagamentos (depósitos)" value={data?.webhooks.payment ?? ""} />
            <Copyable label="Payouts (saques)" value={data?.webhooks.payout ?? ""} />
            <p className="text-xs text-muted-foreground">
              Cadastre estas URLs no painel da NOWPayments. Todas as notificações são validadas com
              assinatura HMAC antes de qualquer crédito.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
