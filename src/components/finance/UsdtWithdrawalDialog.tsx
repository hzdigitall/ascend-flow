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

interface Props {
  usdtBalance?: number | undefined;
  onSuccess?: () => void;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function UsdtWithdrawalDialog({ usdtBalance = 0, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const value = Number(amount.replace(",", "."));
  const valid = value > 0 && value <= usdtBalance && ADDRESS_RE.test(address.trim());

  async function submit() {
    setLoading(true);
    try {
      await requestUsdtWithdrawal({ data: { amount: value, address: address.trim() } });
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
          <DialogTitle>Saque em USDT (BEP20)</DialogTitle>
          <DialogDescription>
            Saldo disponível: {usdtBalance.toFixed(2)} USDT. O envio ocorre após aprovação
            administrativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usdtValue">Valor (USDT)</Label>
            <Input
              id="usdtValue"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
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
          <Alert>
            <AlertDescription>
              Confirme que o endereço aceita <strong>USDT na rede BEP20 (USDTBSC)</strong>. Envios para redes
              incompatíveis são irreversíveis.
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
