import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, StatCard, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTimeBR, pts } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pontos")({
  head: () => ({
    meta: [
      { title: "Meus pontos — Arena Suplementos" },
      { name: "description", content: "Histórico completo de entrada e saída de pontos Arena na sua conta." },
      { property: "og:title", content: "Meus pontos — Arena Suplementos" },
      { property: "og:description", content: "Veja como seus pontos Arena foram creditados e usados." },
    ],
  }),
  component: PointsPage,
});

function PointsPage() {
  const { wallet } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["points-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const earned = (data ?? [])
    .filter((t) => t.direction === "in")
    .reduce((acc, t) => acc + Number(t.points), 0);
  const spent = (data ?? [])
    .filter((t) => t.direction === "out")
    .reduce((acc, t) => acc + Number(t.points), 0);

  return (
    <UserShell>
      <PageHeader
        title="Meus pontos"
        description="Acompanhe cada crédito e resgate de pontos."
        action={
          <Button asChild>
            <Link to="/loja">
              <ShoppingBag className="mr-2 h-4 w-4" /> Trocar pontos
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo atual" value={pts(wallet?.points_balance)} icon={Coins} />
        <StatCard label="Total acumulado" value={pts(earned)} icon={Coins} tone="success" />
        <StatCard label="Total resgatado" value={pts(spent)} icon={ShoppingBag} tone="secondary" />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Coins}
              title="Nenhum ponto movimentado"
              description="Ative um plano para receber seus primeiros pontos."
              action={
                <Button asChild>
                  <Link to="/planos">Ver planos</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dateTimeBR(tx.created_at)}
                      </TableCell>
                      <TableCell
                        className={
                          tx.direction === "in"
                            ? "text-right font-semibold text-success"
                            : "text-right font-semibold text-destructive"
                        }
                      >
                        {tx.direction === "in" ? "+" : "-"}
                        {pts(tx.points)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {pts(tx.balance_after)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </UserShell>
  );
}
