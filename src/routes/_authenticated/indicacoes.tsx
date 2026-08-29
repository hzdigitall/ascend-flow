import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Copy, UserCheck, Info, Trophy, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { dateBR } from "@/lib/format";
import { referralLink } from "@/lib/site";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import careerPlanAsset from "@/assets/career-plan.png.asset.json";
import { Progress } from "@/components/ui/progress";
import { pts as formatPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#25D366" aria-hidden focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.94 11.94 0 005.71 1.454h.005c6.585 0 11.946-5.359 11.949-11.945a11.87 11.87 0 00-3.495-8.411" />
    </svg>
  );
}

function whatsappHref(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D+/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}


export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({
    meta: [
      { title: "Indicações — Arena Suplementos" },
      { name: "description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários na Arena Suplementos." },
      { property: "og:title", content: "Indicações — Arena Suplementos" },
      { property: "og:description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários na Arena Suplementos." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile, wallet } = useAuth();
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  
  const link = profile?.referral_code ? referralLink(profile.referral_code) : "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["referrals", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_network");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        level: r.level,
        created_at: r.created_at,
        referred_id: r.referred_id,
        is_active: Boolean(r.is_active),
        profiles: { full_name: r.full_name, email: r.email, phone: r.phone },
      }));
    },
  });

  const { data: monthlyTx } = useQuery({
    queryKey: ["points-monthly"],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from("points_transactions")
        .select("points")
        .eq("direction", "in")
        .gte("created_at", start);
      if (error) throw error;
      return (data ?? []).reduce((acc, t) => acc + Number(t.points), 0);
    },
  });

  const groupedReferrals = useMemo(() => {
    const levels = Array.from({ length: 8 }, (_, i) => i + 1);
    const groups: Record<number, typeof data> = {};
    levels.forEach((l) => (groups[l] = []));

    if (data) {
      data.forEach((r) => {
        if (groups[r.level]) {
          groups[r.level]!.push(r);
        }
      });
    }
    return groups;
  }, [data]);

  const careerRanks = [
    { name: "Master", points: 500, bonus: 300 },
    { name: "Bronze", points: 1000, bonus: 500 },
    { name: "Prata", points: 2000, bonus: 800, req: "2 Master" },
    { name: "Ouro", points: 5000, bonus: 1300, req: "4 Master" },
    { name: "Platina", points: 10000, bonus: 2000, req: "4 Prata" },
    { name: "Diamante", points: 20000, bonus: 3000, req: "8 Prata" },
    { name: "Duplo Diamante", points: 40000, bonus: 4500, req: "10 Ouro" },
    { name: "Triplo Diamante", points: 80000, bonus: 6500, req: "10 Diamante" },
    { name: "Imperial", points: 160000, bonus: 9000, req: "10 Duplo Diamante" },
    { name: "Embaixador", points: 320000, bonus: 12000, req: "5 Imperial" },
    { name: "Presidente", points: 500000, bonus: 16000, req: "2 Embaixador" },
    { name: "Titan", points: 1000000, bonus: 25000, req: "1 Presidente" },
  ];

  const currentPoints = wallet?.points_balance || 0;
  const careerRanksSorted = careerRanks.sort((a, b) => a.points - b.points);
  const nextRank = careerRanksSorted.find(r => r.points > currentPoints) || careerRanksSorted[careerRanksSorted.length - 1];
  const currentRank = [...careerRanksSorted].reverse().find(r => r.points <= currentPoints) || null;
  const progress = nextRank ? Math.min((currentPoints / nextRank.points) * 100, 100) : 100;

  return (
    <UserShell>
      <PageHeader
        title="Rede e Carreira"
        description="Acompanhe sua rede de indicados e sua evolução no Plano de Carreira."
      />

      <Tabs defaultValue="rede" className="w-full">
        <TabsList className="mb-8 grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="rede">Minha Rede</TabsTrigger>
          <TabsTrigger value="carreira">Plano de Carreira</TabsTrigger>
        </TabsList>

        <TabsContent value="carreira" className="space-y-6">
          <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-card">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-primary" />
                    <h3 className="text-2xl font-bold">Seu Progresso</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Você tem <span className="font-bold text-primary">{formatPoints(currentPoints)}</span> Pontos Arena.
                  </p>
                </div>
                {currentRank && (
                  <div className="flex items-center gap-3 rounded-2xl bg-primary px-6 py-3 text-white shadow-lg">
                    <Star className="h-6 w-6 fill-current" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Patente Atual</p>
                      <p className="text-xl font-black">{currentRank.name}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Próxima meta: <span className="text-foreground">{nextRank?.name || "Titan"}</span></span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatPoints(currentPoints)} pontos</span>
                  <span>{formatPoints(nextRank?.points || currentPoints)} pontos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 shadow-card">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b p-6">
                  <h3 className="font-bold">Ranks e Recompensas</h3>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary uppercase">
                    Bônus Mensal
                  </div>
                </div>
                <div className="divide-y overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3">Rank</th>
                        <th className="px-6 py-3">Pontos</th>
                        <th className="px-6 py-3">Requisitos</th>
                        <th className="px-6 py-3 text-right">Bônus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {careerRanks.map((rank) => (
                        <tr 
                          key={rank.name} 
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            currentRank?.name === rank.name && "bg-primary/5 font-bold"
                          )}
                        >
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-2">
                              {currentPoints >= rank.points ? (
                                <Star className="h-4 w-4 fill-primary text-primary" />
                              ) : (
                                <Star className="h-4 w-4 text-muted-foreground" />
                              )}
                              {rank.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{formatPoints(rank.points)}</td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">{rank.req || "Apenas Pontos"}</td>
                          <td className="px-6 py-4 text-right font-bold text-primary">R$ {rank.bonus.toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-primary/10">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Como ganhar pontos?</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Seus Depósitos</p>
                      <p className="text-xs text-muted-foreground">Cada R$ 50,00 investidos em planos Arena rendem 5 Pontos Arena.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Indicações Diretas</p>
                      <p className="text-xs text-muted-foreground">Quando um indicado do seu 1º nível ativa um plano, você ganha pontos na mesma proporção (R$ 50 = 5 pts).</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-xl bg-muted p-4">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Visão Geral do Plano</p>
                  <img 
                    src={careerPlanAsset.url} 
                    alt="Plano de Carreira Arena Suplementos" 
                    className="mt-4 rounded-lg shadow-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rede" className="space-y-6">
          <Card className="shadow-card">
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 rounded-xl bg-muted p-3">
                <p className="break-all text-xs text-muted-foreground">
                  {link || "—"}
                </p>
              </div>
              <Button
                className="shrink-0"
                disabled={!link}
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar link
              </Button>
            </CardContent>
          </Card>

          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-12">
                <EmptyState
                  icon={Users}
                  title="Você ainda não tem indicados"
                  description="Compartilhe seu link e comece a construir sua rede."
                />
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="1" className="w-full">
              <TabsList className="mb-6 flex w-full justify-start overflow-x-auto bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {Object.keys(groupedReferrals).map((level) => (
                  <TabsTrigger
                    key={level}
                    value={level}
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Nível {level}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                      {groupedReferrals[Number(level)]?.length || 0}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedReferrals).map(([level, items]) => (
                <TabsContent key={level} value={level}>
                  <Card className="shadow-card">
                    <CardContent className="p-4 sm:p-6">
                      {items && items.length > 0 ? (
                        <ul className="divide-y">
                          {items.map((r) => (
<li
                              key={r.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-4 sm:gap-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                                  <UserCheck className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {(r.profiles as { full_name?: string } | null)?.full_name?.trim() ||
                                      "Sem nome"}
                                  </p>
                                  {(r.profiles as { email?: string } | null)?.email && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {(r.profiles as { email?: string } | null)?.email}
                                    </p>
                                  )}
                                  <p className="truncate text-xs text-muted-foreground">
                                    Cadastro em {dateBR(r.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {whatsappHref((r.profiles as { phone?: string } | null)?.phone) && (
<a
                                    href={whatsappHref((r.profiles as { phone?: string } | null)?.phone)!}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Conversar no WhatsApp"
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/12 text-[#25D366] ring-1 ring-inset ring-[#25D366]/25 transition-opacity hover:opacity-80"
                                  >
                                    <WhatsAppIcon className="h-5 w-5" />
                                  </a>
                                )}
                                <StatusBadge status={r.is_active ? "active" : "inactive"} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground"
                                  onClick={() => setSelectedReferral(r)}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          icon={Users}
                          title={`Nenhum indicado no Nível ${level}`}
                          description="Continue expandindo sua rede para alcançar este nível."
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedReferral}
        onOpenChange={(open) => !open && setSelectedReferral(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Indicado</DialogTitle>
            <DialogDescription>
              Informações detalhadas sobre o usuário em sua rede.
            </DialogDescription>
          </DialogHeader>
          {selectedReferral && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-bold">
                                            {(selectedReferral.profiles as any)?.full_name?.trim() || "Sem nome"}
                                          </p>
                                          {(selectedReferral.profiles as any)?.email && (
                                            <p className="text-sm text-muted-foreground">
                                              {(selectedReferral.profiles as any)?.email}
                                            </p>
                                          )}
                                          <p className="text-sm text-muted-foreground">
                                            Nível {selectedReferral.level} da sua rede
                                          </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedReferral.is_active ? "active" : "inactive"} />
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p className="mt-1 text-sm font-medium">
                    {dateBR(selectedReferral.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">ID de Referência</p>
                <p className="mt-1 font-mono text-xs text-primary">
                  {selectedReferral.referred_id}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UserShell>
  );
}
