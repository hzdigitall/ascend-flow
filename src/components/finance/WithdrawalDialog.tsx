import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { checkWithdrawalWindow } from "@/lib/withdrawal-window";

import { useServerFn } from "@tanstack/react-start";
import { Banknote, Clock, AlertCircle } from "lucide-react";
import { requestPixWithdrawal } from "@/lib/payouts.functions";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  wallet: z.enum(["earnings", "referral"]),
  amount: z.number().min(10, "Mínimo R$ 10,00"),
  keyType: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
  key: z.string().min(3, "Chave inválida"),
});

type FormValues = z.infer<typeof formSchema>;

interface WithdrawalDialogProps {
  earningsBalance?: number | undefined;
  referralBalance?: number | undefined;
  onSuccess?: () => void;
}

export function WithdrawalDialog({ 
  earningsBalance = 0, 
  referralBalance = 0,
  onSuccess 
}: WithdrawalDialogProps) {
  const [open, setOpen] = useState(false);
  const requestWd = useServerFn(requestPixWithdrawal);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      wallet: "earnings",
      amount: 10,
      keyType: "cpf",
      key: "",
    },
  });

  const selectedWallet = form.watch("wallet");
  const currentBalance = (selectedWallet === "earnings" ? earningsBalance : referralBalance) ?? 0;

  // Regras de janela centralizadas em @/lib/withdrawal-window (horário de Brasília).
  const windowStatus = checkWithdrawalWindow(selectedWallet);

  async function onSubmit(values: FormValues) {
    if (values.amount > currentBalance) {
      toast.error("Saldo insuficiente nesta carteira.");
      return;
    }

    const win = checkWithdrawalWindow(values.wallet);
    if (!win.isOpen) {
      toast.error(win.message);
      return;
    }

    try {
      await requestWd({ data: values });
      toast.success("Solicitação de saque enviada com sucesso!");
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar saque.");
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Banknote className="mr-2 h-4 w-4" /> Solicitar Saque
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Solicitar Saque PIX</DialogTitle>
          <DialogDescription>
            Escolha a carteira e informe os dados para recebimento. Taxa de 2% aplicada.
          </DialogDescription>
        </DialogHeader>

        {!windowStatus.isOpen && (
          <Alert variant="destructive" className="mt-2">
            <Clock className="h-4 w-4" />
            <AlertTitle>Indisponível agora</AlertTitle>
            <AlertDescription>{windowStatus.message}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="wallet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carteira de Origem</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a carteira" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="earnings">Rendimentos ({brl(earningsBalance)})</SelectItem>
                      <SelectItem value="referral">Bônus/Indicação ({brl(referralBalance)})</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Saque</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      {...field} 
                      onChange={e => field.onChange(parseFloat(e.target.value))} 
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground">
                    Saldo disponível: {brl(currentBalance)}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="keyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Chave</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Celular</SelectItem>
                        <SelectItem value="random">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input placeholder="Sua chave aqui" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={!windowStatus.isOpen || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Processando..." : "Confirmar Saque"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
