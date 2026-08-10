import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({
    meta: [
      { title: "Indicações — Nexora" },
      { name: "description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários." },
      { property: "og:title", content: "Indicações — Nexora" },
      { property: "og:description", content: "Veja sua rede de indicados por nível e o link para convidar novos usuários." },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
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

  return (
    <UserShell>
      <PageHeader title="Indicações" description="Sua rede e o link para convidar novas pessoas." />

      <Card className="shadow-card">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 rounded-xl bg-muted p-3">
            <p className="break-all text-xs text-muted-foreground">{link || "—"}</p>
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

      <Card className="shadow-card">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="Você ainda não tem indicados"
              description="Compartilhe seu link e comece a construir sua rede."
            />
          ) : (
            <ul className="divide-y">
              {data!.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {(r.profiles as { full_name: string } | null)?.full_name ?? "Usuário"}
                    </p>
                    <p className="text-xs text-muted-foreground">{dateBR(r.created_at)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-purple-soft px-3 py-1 text-xs font-semibold text-brand-purple">
                    Nível {r.level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
