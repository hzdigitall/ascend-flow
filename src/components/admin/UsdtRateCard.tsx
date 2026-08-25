import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bitcoin } from "lucide-react";
import { adminSaveUsdtRate } from "@/lib/settings.functions";
import { fmtRate, normalizeRate } from "@/lib/usdt";

interface Props {
  currentRate: number;
  onSaved?: () => void;
}

/** Cotação interna USDT/BRL usada em depósitos, saques e compra de planos. */
export function UsdtRateCard({ currentRate, onSaved }: Props) {
  const save = useServerFn(adminSaveUsdtRate);
  const [value, setValue] = useState(String(currentRate));
  const [loading, setLoading] = useState(false);

  useEffect(() => setValue(String(currentRate)), [currentRate]);

  const parsed = Number(value.replace(",", "."));

  async function submit() {
    setLoading(true);
    try {
      const res = await save({ data: { rate: parsed } });
      toast.success(`Cotação atualizada: ${fmtRate(res.rate)}`);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar a cotação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bitcoin className="h-4 w-4 text-primary" /> Cotação interna USDT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Valor em reais de 1 USDT. Usado para converter depósitos, saques e compras de plano em
          USDT. A taxa é congelada em cada transação no momento da solicitação.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="usdtRate">1 USDT = R$</Label>
            <Input
              id="usdtRate"
              className="w-40"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
          <Button
            onClick={() => void submit()}
            disabled={loading || !(parsed > 0) || parsed === normalizeRate(currentRate)}
          >
            Salvar cotação
          </Button>
          <span className="pb-2 text-xs text-muted-foreground">
            Atual: {fmtRate(currentRate)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
