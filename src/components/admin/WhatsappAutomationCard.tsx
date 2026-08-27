import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import {
  getWhatsappSettings,
  saveWhatsappToken,
  sendWhatsappTest,
  setWhatsappFlags,
} from "@/lib/whatsapp.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const events = [
  { key: "notify_deposit", label: "Depósito confirmado", hint: "PIX e USDT creditados" },
  { key: "notify_withdrawal", label: "Saques", hint: "Solicitação, pagamento e recusa" },
  { key: "notify_referral", label: "Indicação", hint: "Novo indicado direto cadastrado" },
  { key: "notify_commission", label: "Comissão", hint: "Comissão recebida da rede" },
] as const;

export function WhatsappAutomationCard() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getWhatsappSettings);
  const saveToken = useServerFn(saveWhatsappToken);
  const setFlags = useServerFn(setWhatsappFlags);
  const sendTest = useServerFn(sendWhatsappTest);

  const [token, setToken] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "whatsapp-settings"],
    queryFn: () => fetchSettings({ data: undefined }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp-settings"] });

  const tokenMutation = useMutation({
    mutationFn: () => saveToken({ data: { token: token.trim() } }),
    onSuccess: (res) => {
      toast.success(res.message);
      setToken("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const flagsMutation = useMutation({
    mutationFn: (patch: Record<string, boolean>) => setFlags({ data: patch }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => sendTest({ data: { phone: testPhone } }),
    onSuccess: (res) => (res.ok ? toast.success(res.message) : toast.error(res.message)),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Automação de WhatsApp (PlugSend)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mensagens automáticas de depósito, saque, indicação e comissão.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {data?.enabled ? "Ativa" : "Inativa"}
          </span>
          <Switch
            checked={data?.enabled ?? false}
            disabled={isLoading || flagsMutation.isPending}
            onCheckedChange={(checked) => flagsMutation.mutate({ enabled: checked })}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="plugsend-token">Token da API PlugSend</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="plugsend-token"
              type="password"
              autoComplete="off"
              placeholder={data?.masked ?? "Cole aqui o token da PlugSend"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button
              onClick={() => tokenMutation.mutate()}
              disabled={token.trim().length < 8 || tokenMutation.isPending}
            >
              {tokenMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar token"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {data?.tokenConfigured
              ? `Token configurado: ${data.masked}. O valor é armazenado criptografado e nunca é exposto no navegador.`
              : "Nenhum token cadastrado. A automação só pode ser ativada com um token válido."}
          </p>
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <div
              key={event.key}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.hint}</p>
              </div>
              <Switch
                checked={(data?.[event.key] as boolean | undefined) ?? false}
                disabled={isLoading || flagsMutation.isPending}
                onCheckedChange={(checked) => flagsMutation.mutate({ [event.key]: checked })}
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="plugsend-test">Enviar mensagem de teste</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="plugsend-test"
              placeholder="5511999999999"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testPhone.replace(/\D/g, "").length < 10 || testMutation.isPending}
            >
              {testMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar teste"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
