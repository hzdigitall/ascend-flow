import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Network, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminListRegistry,
  adminRegistryDetail,
  adminUpdateAccount,
  adminSetSponsor,
  adminRemoveReferral,
} from "@/lib/admin-registry.functions";
import { adminDeleteUser } from "@/lib/admin.functions";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { dateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/registros")({
  head: () => ({
    meta: [
      { title: "Registros do site — Arena Suplementos" },
      {
        name: "description",
        content: "Consulta livre dos registros: dados de acesso, edição de conta e rede de indicações.",
      },
      { property: "og:title", content: "Registros do site — Arena Suplementos" },
      {
        property: "og:description",
        content: "Painel administrativo de registros da Arena Suplementos.",
      },
    ],
  }),
  component: RegistryPage,
});

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  referral_code: string;
  blocked: boolean;
  created_at: string;
};

function RegistryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListRegistry);
  const detailFn = useServerFn(adminRegistryDetail);
  const updateFn = useServerFn(adminUpdateAccount);
  const deleteFn = useServerFn(adminDeleteUser);
  const sponsorFn = useServerFn(adminSetSponsor);
  const removeRefFn = useServerFn(adminRemoveReferral);

  const [sponsorInput, setSponsorInput] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [networkTarget, setNetworkTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "registry", search, page],
    queryFn: () => listFn({ data: search ? { search, page, pageSize } : { page, pageSize } }),
    staleTime: 30_000,
  });

  const detail = useQuery({
    queryKey: ["admin", "registry-detail", networkTarget?.id],
    queryFn: () => detailFn({ data: { userId: networkTarget!.id } }),
    enabled: Boolean(networkTarget?.id),
  });

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      const payload: { userId: string; fullName?: string; email?: string; password?: string } = {
        userId: editTarget.id,
      };
      if (fullName.trim() && fullName.trim() !== editTarget.full_name) {
        payload.fullName = fullName.trim();
      }
      if (email.trim() && email.trim().toLowerCase() !== editTarget.email.toLowerCase()) {
        payload.email = email.trim();
      }
      if (password.trim()) payload.password = password.trim();
      if (!payload.fullName && !payload.email && !payload.password) {
        throw new Error("Nenhuma alteração informada.");
      }
      return updateFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Registro atualizado.");
      setEditTarget(null);
      setPassword("");
      qc.invalidateQueries({ queryKey: ["admin", "registry"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar registro."),
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "registry"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir usuário."),
  });

  const saveSponsor = useMutation({
    mutationFn: async (sponsor: string | null) =>
      sponsorFn({ data: { userId: networkTarget!.id, sponsor } }),
    onSuccess: (res: any) => {
      toast.success(res?.sponsor ? "Patrocinador atualizado." : "Patrocinador removido.");
      setSponsorInput("");
      qc.invalidateQueries({ queryKey: ["admin", "registry-detail"] });
      qc.invalidateQueries({ queryKey: ["admin", "registry"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao alterar patrocinador."),
  });

  const removeReferral = useMutation({
    mutationFn: async (referredId: string) =>
      removeRefFn({ data: { sponsorId: networkTarget!.id, referredId } }),
    onSuccess: () => {
      toast.success("Indicado removido da rede.");
      qc.invalidateQueries({ queryKey: ["admin", "registry-detail"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover indicado."),
  });

  const rows = (data?.rows ?? []) as Row[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="Registros do site"
        description="Consulte livremente os cadastros, edite nome, e-mail e senha, veja a rede de indicações e exclua contas."
      />

      <Card className="shadow-card">
        <CardContent className="p-0">
          <form
            className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por e-mail, nome, CPF ou código de indicação"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Buscar
            </Button>
          </form>

          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum registro encontrado"
              description="Ajuste a busca e tente novamente."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Usuário</th>
                    <th className="px-6 py-3">Código</th>
                    <th className="px-6 py-3">Cadastro</th>
                    <th className="px-6 py-3">Situação</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.cpf || "—"} · {u.phone || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold tracking-widest text-primary">
                        {u.referral_code}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {dateTimeBR(u.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            u.blocked
                              ? "bg-destructive/12 text-destructive"
                              : "bg-success/12 text-success",
                          )}
                        >
                          {u.blocked ? "Bloqueado" : "Liberado"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditTarget(u);
                              setFullName(u.full_name);
                              setEmail(u.email);
                              setPassword("");
                            }}
                          >
                            <Pencil className="mr-2 size-3.5" /> Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setNetworkTarget(u)}>
                            <Network className="mr-2 size-3.5" /> Indicações
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col items-center justify-between gap-3 border-t p-4 text-xs text-muted-foreground sm:flex-row">
                <span>
                  {total} registro(s) · página {page + 1} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editar conta */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              Alterações de e-mail e senha valem imediatamente para o login do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reg-name">Nome completo</Label>
              <Input id="reg-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-email">E-mail de acesso</Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-pass">Nova senha (opcional)</Label>
              <Input
                id="reg-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveAccount.mutate()} disabled={saveAccount.isPending}>
              {saveAccount.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rede de indicações */}
      <Dialog open={Boolean(networkTarget)} onOpenChange={(v) => !v && setNetworkTarget(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Indicações — {networkTarget?.full_name}</DialogTitle>
            <DialogDescription>
              {detail.data?.sponsor
                ? `Patrocinador: ${detail.data.sponsor.full_name} (${detail.data.sponsor.email})`
                : "Sem patrocinador."}
            </DialogDescription>
          </DialogHeader>

          {detail.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Total na rede: <strong>{detail.data?.total ?? 0}</strong>
              </p>
              {(detail.data?.levels ?? []).map((lvl) => (
                <div key={lvl.level} className="rounded-xl border">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Nível {lvl.level}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lvl.members.length} indicado(s)
                    </span>
                  </div>
                  {lvl.members.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum indicado.</p>
                  ) : (
                    <ul className="divide-y">
                      {lvl.members.slice(0, 50).map((m) => (
                        <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                          <div>
                            <p className="text-sm font-medium">{m.full_name}</p>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {dateTimeBR(m.created_at)}
                          </span>
                        </li>
                      ))}
                      {lvl.members.length > 50 ? (
                        <li className="px-4 py-2 text-xs text-muted-foreground">
                          + {lvl.members.length - 50} não exibidos
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Esta ação remove definitivamente {deleteTarget?.full_name} ({deleteTarget?.email}) e
              todos os seus dados. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && removeUser.mutate(deleteTarget.id)}
              disabled={removeUser.isPending}
            >
              {removeUser.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
