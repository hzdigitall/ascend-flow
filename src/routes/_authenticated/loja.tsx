import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { pts } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/loja")({
  head: () => ({
    meta: [
      { title: "Loja de prêmios — Nexora" },
      { name: "description", content: "Troque seus pontos por produtos disponíveis no catálogo." },
      { property: "og:title", content: "Loja de prêmios — Nexora" },
      { property: "og:description", content: "Troque seus pontos por produtos disponíveis no catálogo." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("points_price", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <UserShell>
      <PageHeader title="Loja de prêmios" description="Use seus pontos para resgatar produtos." />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState icon={ShoppingBag} title="Catálogo vazio" description="Novos prêmios em breve." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.map((p) => (
            <Card key={p.id} className="overflow-hidden shadow-card">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 w-full place-items-center bg-muted text-muted-foreground">
                  <ShoppingBag className="h-8 w-8" />
                </div>
              )}
              <CardContent className="p-5">
                <h2 className="truncate text-base font-bold">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-3 text-lg font-extrabold text-primary">{pts(p.points_price)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.stock > 0 ? `${p.stock} em estoque` : "Sem estoque"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </UserShell>
  );
}
