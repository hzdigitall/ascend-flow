import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Play, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { adminNav } from "@/lib/adminNav";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, pts as formatPoints } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin/bla")({
  head: () => ({
    meta: [
      { title: "BLA — Bônus de Liderança Ativa | Arena Suplementos" },
      {
        name: "description",
        content:
          "Apure a pontuação mensal, as graduações e os pagamentos do Bônus de Liderança Ativa da Arena.",
      },
      { property: "og:title", content: "BLA — Bônus de Liderança Ativa | Arena Suplementos" },
      {
        property: "og:description",
        content: "Painel administrativo do Bônus de Liderança Ativa da Arena Suplementos.",
      },
    ],
  }),
  component: AdminBlaPage,
});

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const statusLabel: Record<string, string> = {
  paid: "Pago",
  not_qualified: "Não qualificado",
  manual: "Manual",
};

type RankForm = {
  id?: string;
  name: string;
  level: string;
  points_required: string;
  bonus: string;
  required_rank_level: string;
  required_rank_count: string;
  active: boolean;
};

const emptyRank: RankForm = {
  name: "",
  level: "",
  points_required: "",
  bonus: "",
  required_rank_level: "0",
  required_rank_count: "0",
  active: true,
};

function AdminBlaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [rankInput, setRankInput] = useState("0");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);
  const [rankForm, setRankForm] = useState<RankForm | null>(null);
  const [savingRank, setSavingRank] = useState(false);

  const period = `${month}-01`;


  const ranksQ = useQuery({
    queryKey: ["career-ranks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("career_ranks")
        .select("*")
        .order("level", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "bla", period],
    queryFn: async () => {
      const [points, careers, payouts] = await Promise.all([
        supabase
          .from("career_monthly_points")
          .select("user_id, points, profiles(full_name, email)")
          .eq("period", period)
          .order("points", { ascending: false })
          .limit(500),
        supabase.from("user_career").select("user_id, rank_level, rank_name"),
        supabase.from("bla_payouts").select("*").eq("period", period),
      ]);
      if (points.error) throw points.error;
      if (careers.error) throw careers.error;
      if (payouts.error) throw payouts.error;

      const careerMap = new Map((careers.data ?? []).map((c: any) => [c.user_id, c]));
      const payoutMap = new Map((payouts.data ?? []).map((p: any) => [p.user_id, p]));

      return (points.data ?? []).map((r: any) => ({
        ...r,
        career: careerMap.get(r.user_id) ?? null,
        payout: payoutMap.get(r.user_id) ?? null,
      }));
    },
  });

  const totals = useMemo(() => {
    const rows = rowsQ.data ?? [];
    const paid = rows.filter((r: any) => r.payout?.status === "paid");
    return {
      users: rows.length,
      qualified: paid.length,
      amount: paid.reduce((s: number, r: any) => s + Number(r.payout?.amount ?? 0), 0),
    };
  }, [rowsQ.data]);

  const term = search.trim().toLowerCase();
  const rows = (rowsQ.data ?? []).filter((r: any) => {
    if (!term) return true;
    return (
      r.profiles?.full_name?.toLowerCase().includes(term) ||
      r.profiles?.email?.toLowerCase().includes(term)
    );
  });

  async function runBla() {
    if (!profile?.id) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc("admin_run_bla", {
        _admin: profile.id,
        _period: period,
      });
      if (error) throw error;
      toast.success(`Apuração concluída: ${data ?? 0} pagamento(s).`);
      qc.invalidateQueries({ queryKey: ["admin", "bla", period] });
    } catch (error) {
      toast.error((error as Error).message || "Falha ao apurar o BLA.");
    } finally {
      setRunning(false);
    }
  }

  async function saveRank() {
    if (!rankForm) return;
    setSavingRank(true);
    try {
      const payload = {
        name: rankForm.name.trim(),
        level: Number(rankForm.level),
        points_required: Number(rankForm.points_required),
        bonus: Number(rankForm.bonus),
        required_rank_level:
          Number(rankForm.required_rank_level) > 0 ? Number(rankForm.required_rank_level) : null,
        required_rank_count: Number(rankForm.required_rank_count) || 0,
        active: rankForm.active,
      };
      if (!payload.name) throw new Error("Informe o nome da graduação.");
      if (!Number.isFinite(payload.level) || payload.level < 1)
        throw new Error("Nível inválido.");
      if (!Number.isFinite(payload.points_required) || payload.points_required < 0)
        throw new Error("Pontos exigidos inválidos.");
      if (!Number.isFinite(payload.bonus) || payload.bonus < 0)
        throw new Error("Valor do BLA inválido.");

      const { error } = rankForm.id
        ? await supabase.from("career_ranks").update(payload).eq("id", rankForm.id)
        : await supabase.from("career_ranks").insert(payload);
      if (error) throw error;

      toast.success("Graduação salva.");
      setRankForm(null);
      qc.invalidateQueries({ queryKey: ["career-ranks"] });
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar a graduação.");
    } finally {
      setSavingRank(false);
    }
  }

  async function toggleRank(rank: any) {
    const { error } = await supabase
      .from("career_ranks")
      .update({ active: !rank.active })
      .eq("id", rank.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["career-ranks"] });
  }


  function openEdit(row: any) {
    setEditing(row);
    setPointsInput(String(row.points ?? 0));
    setRankInput(String(row.career?.rank_level ?? 0));
    setReason("");
  }

  async function saveEdit() {
    if (!profile?.id || !editing) return;
    try {
      const points = Number(pointsInput);
      if (!Number.isFinite(points) || points < 0) throw new Error("Pontuação inválida.");

      if (points !== Number(editing.points)) {
        const { error } = await supabase.rpc("admin_adjust_career_points", {
          _admin: profile.id,
          _user: editing.user_id,
          _period: period,
          _points: points,
          _reason: reason || "Ajuste manual",
        });
        if (error) throw error;
      }

      const level = Number(rankInput);
      if (level !== Number(editing.career?.rank_level ?? 0)) {
        const { error } = await supabase.rpc("admin_set_career_rank", {
          _admin: profile.id,
          _user: editing.user_id,
          _level: level,
          _reason: reason || "Ajuste manual",
        });
        if (error) throw error;
      }

      toast.success("Dados atualizados.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "bla", period] });
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar.");
    }
  }

  return (
    <AppShell items={adminNav} variant="admin">
      <PageHeader
        title="BLA — Bônus de Liderança Ativa"
        description="Pontuação mensal, graduações e pagamentos do bônus de liderança. A apuração roda automaticamente no dia 1º de cada mês."
      />

      <Card className="mb-6 shadow-card">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="bla-month">Período</Label>
            <Input
              id="bla-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="bla-search">Buscar</Label>
            <Input
              id="bla-search"
              placeholder="Nome ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={runBla} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Apurando..." : "Apurar período"}
          </Button>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Pontuando no mês</p>
            <p className="text-2xl font-bold">{totals.users}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Qualificados</p>
            <p className="text-2xl font-bold">{totals.qualified}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <p className="text-xs uppercase text-muted-foreground">Total pago</p>
            <p className="text-2xl font-bold text-primary">{brl(totals.amount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {rowsQ.isLoading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : rowsQ.isError ? (
            <div className="p-6">
              <ErrorState onRetry={() => rowsQ.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Crown}
                title="Nenhuma pontuação neste período"
                description="Assim que houver pontos válidos no mês, os líderes aparecem aqui."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Usuário</th>
                    <th className="px-6 py-3">Pontos do mês</th>
                    <th className="px-6 py-3">Graduação</th>
                    <th className="px-6 py-3">BLA do período</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r: any) => (
                    <tr key={r.user_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{r.profiles?.full_name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{r.profiles?.email}</p>
                      </td>
                      <td className="px-6 py-4">{formatPoints(r.points)}</td>
                      <td className="px-6 py-4">
                        {r.career?.rank_name ? (
                          <Badge variant="secondary">{r.career.rank_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {r.payout ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={r.payout.status === "paid" ? "default" : "secondary"}
                            >
                              {statusLabel[r.payout.status] ?? r.payout.status}
                            </Badge>
                            {Number(r.payout.amount) > 0 && (
                              <span className="font-semibold text-primary">
                                {brl(Number(r.payout.amount))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Não apurado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar líder</DialogTitle>
            <DialogDescription>
              Ajuste a pontuação do período e a graduação de {editing?.profiles?.full_name || "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="bla-points">Pontos do período</Label>
              <Input
                id="bla-points"
                type="number"
                min={0}
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Graduação</Label>
              <Select value={rankInput} onValueChange={setRankInput}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem graduação</SelectItem>
                  {(ranksQ.data ?? []).map((rank: any) => (
                    <SelectItem key={rank.level} value={String(rank.level)}>
                      {rank.name} — {formatPoints(rank.points_required)} pts ·{" "}
                      {brl(Number(rank.bonus))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bla-reason">Motivo</Label>
              <Input
                id="bla-reason"
                placeholder="Registrado na auditoria"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
