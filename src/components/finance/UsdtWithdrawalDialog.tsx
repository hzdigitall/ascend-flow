import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Bitcoin } from "lucide-react";
import { requestUsdtWithdrawal } from "@/lib/payouts.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/useSettings";
import { useUsdtRate } from "@/hooks/useUsdtRate";
import { brl } from "@/lib/format";
import { brlToUsdt, fmtRate, fmtUsdt, USDT_NETWORK_LABEL } from "@/lib/usdt";
import { checkWithdrawalWindow, WITHDRAW_WINDOW_TEXT } from "@/lib/withdrawal-window";
import { Clock } from "lucide-react";

interface Props {
  earningsBalance?: number | undefined;
  referralBalance?: number | undefined;
  onSuccess?: () => void;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function UsdtWithdrawalDialog({
  earningsBalance = 0,
  referralBalance = 0,
  onSuccess,
}: Props) {
  const submitFn = useServerFn(requestUsdtWithdrawal);
  const { get } = useSettings();
  const rate = useUsdtRate();
  const feePercent = Number(get<number>("withdraw_fee_percent", 2)) || 0;

  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState<"earnings" | "referral">("earnings");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const balance = wallet === "earnings" ? Number(earningsBalance) : Number(referralBalance);
  const value = Number(amount.replace(",", ".")) || 0;
  // Simulação apenas visual — o backend recalcula e congela a taxa.
  const fee = Math.round(((value * feePercent) / 100) * 100) / 100;
  const net = Math.max(0, Math.round((value - fee) * 100) / 100);
  const usdt = brlToUsdt(net, rate);
  const windowStatus = checkWithdrawalWindow(wallet);
  const valid =
    windowStatus.isOpen && value >= 10 && value <= balance && ADDRESS_RE.test(address.trim());

  async function submit() {
    const win = checkWithdrawalWindow(wallet);
    if (!win.isOpen) {
      toast.error(win.message);
      return;
    }
    setLoading(true);
    try {
      await submitFn({ data: { wallet, amount: value, address: address.trim() } });
      toast.success("Saque em USDT solicitado. Aguarde a aprovação do administrador.");
      setOpen(false);
      setAmount("");
      setAddress("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao solicitar o saque.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bitcoin className="h-4 w-4" /> Sacar USDT
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saque em USDT ({USDT_NETWORK_LABEL})</DialogTitle>
          <DialogDescription>
            Informe o valor em reais a debitar do seu saldo. A conversão usa a cotação interna (
            {fmtRate(rate)}) e o envio ocorre após aprovação administrativa. {WITHDRAW_WINDOW_TEXT}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!windowStatus.isOpen && (
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertDescription>{windowStatus.message}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Carteira de origem</Label>
            <Select value={wallet} onValueChange={(v) => setWallet(v as "earnings" | "referral")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earnings">
                  Rendimentos — {brl(earningsBalance ?? 0)}
                </SelectItem>
                <SelectItem value="referral">
                  Bônus de indicação — {brl(referralBalance ?? 0)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usdtValue">Valor do saque (R$)</Label>
            <Input
              id="usdtValue"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">Saldo disponível: {brl(balance)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usdtAddress">Endereço da carteira (BEP20)</Label>
            <Input
              id="usdtAddress"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
            />
          </div>

          {value > 0 && (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor solicitado</span>
                <span className="font-medium">{brl(value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa ({feePercent}%)</span>
                <span className="font-medium">- {brl(fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Líquido em reais</span>
                <span className="font-medium">{brl(net)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Você receberá</span>
                <span className="font-semibold text-primary">{fmtUsdt(usdt)}</span>
              </div>
            </div>
          )}

          <Alert>
            <AlertDescription>
              Confirme que o endereço aceita <strong>USDT na rede BEP20 (USDTBSC)</strong>. Envios
              para redes incompatíveis são irreversíveis.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || loading}>
            Solicitar saque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
