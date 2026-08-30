import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { confirmEmailChange, requestEmailChange } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  currentEmail?: string | null | undefined;
  onChanged?: () => void | Promise<void>;
}

export function EmailChangeDialog({ currentEmail, onChanged }: Props) {
  const requestFn = useServerFn(requestEmailChange);
  const confirmFn = useServerFn(confirmEmailChange);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep("email");
    setNewEmail("");
    setCode("");
    setLoading(false);
  };

  const handleRequest = async () => {
    setLoading(true);
    try {
      await requestFn({ data: { newEmail: newEmail.trim() } });
      toast.success("Código enviado para o novo e-mail.");
      setStep("code");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmFn({ data: { code: code.trim() } });
      toast.success("E-mail alterado com sucesso!");
      setOpen(false);
      reset();
      await onChanged?.();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível confirmar o código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-xs">
          <Mail className="mr-2 size-3.5" /> Alterar e-mail de acesso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar e-mail</DialogTitle>
          <DialogDescription>
            {step === "email"
              ? `E-mail atual: ${currentEmail || "—"}. Enviaremos um código de confirmação para o novo endereço.`
              : `Digite o código de 6 dígitos enviado para ${newEmail}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <div className="grid gap-2">
            <Label htmlFor="new-email">Novo e-mail</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="email-code">Código de confirmação</Label>
            <Input
              id="email-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.5em]"
            />
            <Button
              variant="link"
              size="sm"
              className="h-auto justify-start p-0 text-xs"
              onClick={() => setStep("email")}
            >
              Usar outro e-mail
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {step === "email" ? (
            <Button onClick={handleRequest} disabled={loading || newEmail.trim().length < 5}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Enviar código
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={loading || code.length !== 6}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirmar alteração
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
