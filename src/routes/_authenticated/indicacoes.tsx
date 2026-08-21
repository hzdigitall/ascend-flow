import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Copy, UserCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { dateBR } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({
    meta: [
      { title: "Indicações — Arena Saúde" },
      { name: "description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários na Arena Saúde." },
      { property: "og:title", content: "Indicações — Arena Saúde" },
      { property: "og:description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários na Arena Saúde." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  
  const link =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/cadastro?ref=${profile.referral_code}`
      : "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["referrals", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, level, created_at, referred_id, profiles!referrals_referred_id_fkey(full_name)")
        .eq("sponsor_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  return (
    <UserShell>
      <PageHeader
        title="Indicações"
        description="Sua rede e o link para convidar novas pessoas."
      />

      <Card className="mb-6 shadow-card">
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
          <TabsList className="mb-6 flex w-full justify-start overflow-x-auto bg-transparent p-0">
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
                          className="flex items-center justify-between gap-3 py-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserCheck className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {(r.profiles as { full_name: string } | null)
                                  ?.full_name ?? "Usuário"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Cadastro em {dateBR(r.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status="active" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
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
                    {(selectedReferral.profiles as any)?.full_name ?? "Usuário"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nível {selectedReferral.level} da sua rede
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status="active" />
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
