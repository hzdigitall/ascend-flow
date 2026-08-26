import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bitcoin, QrCode } from "lucide-react";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { createPixDeposit, createUsdtDeposit, getDepositMethods } from "@/lib/deposits.functions";
import { useUsdtRate } from "@/hooks/useUsdtRate";
import { brlToUsdt, fmtRate, fmtUsdt } from "@/lib/usdt";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/depositar")({
  head: () => ({
    meta: [
      { title: "Depositar — Arena Saúde" },
      {
        name: "description",
        content: "Adicione saldo à sua conta Arena Saúde via PIX ou USDT BEP20.",
      },
      { property: "og:title", content: "Depositar — Arena Saúde" },
      {
        property: "og:description",
        content: "Adicione saldo à sua conta Arena Saúde via PIX ou USDT BEP20.",
      },
    ],
  }),
  component: DepositPage,
});

function DepositPage() {
  const navigate = useNavigate();
  const methodsFn = useServerFn(getDepositMethods);
  const pixFn = useServerFn(createPixDeposit);
  const usdtFn = useServerFn(createUsdtDeposit);

  const [amount, setAmount] = useState("");
  const [usdtAmount, setUsdtAmount] = useState("");
  const rate = useUsdtRate();
  const usdtValue = Number(usdtAmount.replace(",", ".")) || 0;

  const { data: methods, isLoading } = useQuery({
    queryKey: ["deposit", "methods"],
    queryFn: () => methodsFn({ data: undefined as never }),
  });

  const pix = useMutation({
    mutationFn: () => pixFn({ data: { amount: Number(amount.replace(",", ".")) } }),
    onSuccess: (res) => navigate({ to: "/deposito/$depositId", params: { depositId: res.depositId } }),
    onError: (err: Error) => toast.error(err.message),
  });

  const usdt = useMutation({
    mutationFn: () => usdtFn({ data: { brlAmount: usdtValue } }),
    onSuccess: (res) => navigate({ to: "/deposito/$depositId", params: { depositId: res.depositId } }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <UserShell>
      <PageHeader
        title="Depositar"
        description="Adicione saldo à sua conta para adquirir planos. O crédito é automático após a confirmação."
      />

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-primary" /> PIX (BRL)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {methods?.pix ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor do depósito (R$)</Label>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={pix.isPending || !(Number(amount.replace(",", ".")) > 0)}
                    onClick={() => pix.mutate()}
                  >
                    Gerar QR Code PIX
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertDescription>{methods?.unavailableMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bitcoin className="h-4 w-4 text-primary" /> USDT ({methods?.usdtTicker ?? "USDT"} · {methods?.usdtNetwork ?? "BEP20"})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {methods?.usdt ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="usdtAmount">Valor a creditar no saldo (R$)</Label>
                    <Input
                      id="usdtAmount"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    />
                    <p className="text-xs text-muted-foreground">Cotação interna: {fmtRate(rate)}</p>
                  </div>

                  {usdtValue > 0 && (
                    <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saldo creditado</span>
                        <span className="font-medium">{brl(usdtValue)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-muted-foreground">Você deve enviar</span>
                        <span className="font-semibold text-primary">
                          {fmtUsdt(brlToUsdt(usdtValue, rate))}
                        </span>
                      </div>
                    </div>
                  )}

                  <Alert>
                    <AlertDescription>
                      Envie exclusivamente USDT na rede BEP20 (BNB Smart Chain). Envios em outra rede ou
                      outro ativo não são creditados.
                    </AlertDescription>
                  </Alert>
                  <Button
                    className="w-full"
                    disabled={usdt.isPending || !(usdtValue > 0)}
                    onClick={() => usdt.mutate()}
                  >
                    Gerar endereço de depósito
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertDescription>{methods?.unavailableMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </UserShell>
  );
}
