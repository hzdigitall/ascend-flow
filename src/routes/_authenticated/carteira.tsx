import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, StatCard, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — Nexora" },
      { name: "description", content: "Saldos, extrato completo e comissões recebidas na sua carteira." },
      { property: "og:title", content: "Carteira — Nexora" },
      { property: "og:description", content: "Extrato e saldos da sua conta Nexora." },
    ],
  }),
  component: WalletPage,
});

const WALLET_LABEL: Record<string, string> = {
  main: "Principal",
  earnings: "Ganhos",
  referral: "Indicações",
};

function WalletPage() {
  const { wallet } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: async () => {
      const [txRes, commRes] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("commissions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (txRes.error) throw txRes.error;
      return { transactions: txRes.data ?? [], commissions: commRes.data ?? [] };
    },
  });

  return (
    <UserShell>
      <PageHeader
        title="Carteira"
        description="Todos os créditos e débitos da sua conta."
        action={
          <Button asChild>
            <Link to="/saques">Solicitar saque</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo principal" value={brl(wallet?.main_balance)} icon={Wallet} />
        <StatCard
          label="Ganhos"
          value={brl(wallet?.earnings_balance)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Comissões"
          value={brl(wallet?.referral_balance)}
          icon={Users}
          tone="purple"
        />
      </div>

      <Tabs defaultValue="extrato">
        <TabsList>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato" className="mt-4">
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <TableSkeleton />
              ) : isError ? (
                <ErrorState onRetry={() => refetch()} />
              ) : (data?.transactions.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Sem movimentações"
                  description="Suas movimentações financeiras aparecerão aqui."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Carteira</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Percentual</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">{tx.description}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {WALLET_LABEL[tx.wallet_type] ?? tx.wallet_type}
                          </TableCell>
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
                            {brl(tx.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {brl(tx.balance_after)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-4">
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <TableSkeleton />
              ) : (data?.commissions.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhuma comissão ainda"
                  description="Indique amigos e receba comissões quando eles ativarem um plano."
                  action={
                    <Button asChild>
                      <Link to="/indicacoes">Ver minhas indicações</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nível</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Percentual</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.commissions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">Nível {c.level}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {dateTimeBR(c.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.percentage}%
                          </TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {brl(c.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </UserShell>
  );
}
