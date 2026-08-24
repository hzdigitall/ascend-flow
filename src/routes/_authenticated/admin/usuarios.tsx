import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAdjustPoints,
  adminSendPasswordReset,
  adminUpdateUser,
} from "@/lib/admin.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Gestão de usuários — Arena Saúde" },
      { name: "description", content: "Bloqueio, permissões e ajuste de pontos dos usuários." },
      { property: "og:title", content: "Gestão de usuários — Arena Saúde" },
      { property: "og:description", content: "Administração dos usuários da plataforma." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const updateUser = useServerFn(adminUpdateUser);
  const adjustPoints = useServerFn(adminAdjustPoints);
  const sendReset = useServerFn(adminSendPasswordReset);

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [points, setPoints] = useState("0");
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      const adminIds = new Set(
        (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      return (profiles.data ?? []).map((p) => ({ ...p, isAdmin: adminIds.has(p.id) }));
    },
  });

  const mutateUser = useMutation({
    mutationFn: (v: { userId: string; blocked?: boolean; makeAdmin?: boolean }) =>
      updateUser({ data: v }),
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: (email: string) =>
      sendReset({ data: { email, redirectTo: `${window.location.origin}/login` } }),
    onSuccess: () => toast.success("E-mail de redefinição enviado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const savePoints = useMutation({
    mutationFn: () =>
      adjustPoints({
        data: { userId: target!.id, points: Number(points), reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success("Pontos ajustados.");
      setOpen(false);
      setPoints("0");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader title="Usuários" description="Gerencie os usuários da plataforma." />
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="p-6">
              <ErrorState onRetry={() => refetch()} />
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhum usuário"
                description="Ainda não há usuários cadastrados."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 font-medium">
                    <th className="px-6 py-4">Nome / E-mail</th>
                    <th className="px-6 py-4">CPF / WhatsApp</th>
                    <th className="px-6 py-4">Cadastro</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Admin</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.map((u) => (
                    <tr key={u.id} className="group hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-muted-foreground">{u.cpf || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.phone || "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {dateTimeBR(u.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!u.blocked}
                            onCheckedChange={(v) =>
                              mutateUser.mutate({ userId: u.id, blocked: !v })
                            }
                          />
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              u.blocked
                                ? "bg-destructive/12 text-destructive"
                                : "bg-success/12 text-success",
                            )}
                          >
                            {u.blocked ? "Bloqueado" : "Ativo"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={u.isAdmin}
                          onCheckedChange={(v) =>
                            mutateUser.mutate({ userId: u.id, makeAdmin: v })
                          }
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTarget({ id: u.id, name: u.full_name });
                              setOpen(true);
                            }}
                          >
                            Pontos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetPassword.mutate(u.email)}
                            disabled={resetPassword.isPending}
                          >
                            <KeyRound className="mr-2 size-3.5" /> Senha
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar pontos — {target?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="adj-points">Pontos (use negativo para debitar)</Label>
              <Input
                id="adj-points"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adj-reason">Motivo</Label>
              <Input
                id="adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: bônus promocional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => savePoints.mutate()}
              disabled={savePoints.isPending || !target || reason.trim().length < 3}
            >
              {savePoints.isPending ? "Salvando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
