import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserShell } from "@/components/layout/UserShell";
import { PageHeader, EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Truck, Search, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pts } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { redeemProduct } from "@/lib/app.functions";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/loja")({
  head: () => ({
    meta: [
      { title: "Loja de prêmios — Arena Saúde" },
      { name: "description", content: "Troque seus pontos Arena por produtos disponíveis no catálogo." },
      { property: "og:title", content: "Loja de prêmios — Arena Saúde" },
      { property: "og:description", content: "Troque seus pontos Arena por produtos disponíveis no catálogo." },
    ],
  }),
  component: Page,
});

function Page() {
  const { wallet, refresh } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const redeemFn = useServerFn(redeemProduct);

  const [address, setAddress] = useState({
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    name: "",
  });

  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("points_cost", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleCepBlur = async () => {
    const cep = address.zip.replace(/\D/g, "");
    if (!cep) return;
    if (cep.length !== 8) {
      toast.error("CEP inválido. Digite 8 números.");
      return;
    }

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("Falha na conexão com a API de CEP.");
      
      const data = await response.json();

      if (data.erro) {
        toast.error("CEP não encontrado.");
        setAddress(prev => ({ ...prev, street: "", district: "", city: "", state: "" }));
        return;
      }

      setAddress((prev) => ({
        ...prev,
        street: data.logradouro || "",
        district: data.bairro || "",
        city: data.localidade || "",
        state: data.uf || "",
      }));
      toast.success("Endereço preenchido automaticamente.");
    } catch (error) {
      toast.error("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if ((wallet?.points_balance || 0) < selectedProduct.points_cost) {
      toast.error("Você não tem pontos suficientes.");
      return;
    }

    setIsRedeeming(true);
    try {
      await redeemFn({
        data: {
          productId: selectedProduct.id,
          address: { ...address },
        },
      });
      toast.success("Resgate realizado com sucesso! Prazo de envio de 15 dias.");
      setSelectedProduct(null);
      refresh();
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar resgate.");
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <UserShell>
      <PageHeader title="Loja de prêmios" description="Use seus pontos Arena para resgatar produtos exclusivos. R$ 50 investidos em planos = 5 pontos." />
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
                <div className="flex aspect-square items-center justify-center bg-white p-4">
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="grid h-40 w-full place-items-center bg-muted text-muted-foreground">
                  <ShoppingBag className="h-8 w-8" />
                </div>
              )}
              <CardContent className="p-5">
                <h2 className="truncate text-base font-bold">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-lg font-extrabold text-primary">{pts(p.points_cost)}</p>
                  <Button 
                    size="sm" 
                    className="rounded-full px-4" 
                    disabled={p.stock <= 0 || (wallet?.points_balance || 0) < p.points_cost}
                    onClick={() => setSelectedProduct(p)}
                  >
                    Resgatar
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.stock > 0 ? `${p.stock} em estoque` : "Sem estoque"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Resgate</DialogTitle>
            <DialogDescription>
              Confirme o endereço de entrega para o produto <strong>{selectedProduct?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRedeem} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo do destinatário</Label>
              <Input
                id="name"
                required
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip">CEP</Label>
                <div className="relative">
                  <Input
                    id="zip"
                    required
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                  {isFetchingCep && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  required
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Endereço (Rua/Avenida)</Label>
              <Input
                id="street"
                required
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                placeholder="Rua das Flores"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  required
                  value={address.number}
                  onChange={(e) => setAddress({ ...address, number: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  placeholder="Apto 42 (opcional)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="district">Bairro</Label>
                <Input
                  id="district"
                  required
                  value={address.district}
                  onChange={(e) => setAddress({ ...address, district: e.target.value })}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 p-4 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <Truck className="h-4 w-4 shrink-0 text-primary" />
                <p>
                  O prazo estimado para o envio deste produto é de <strong>15 dias</strong> após a solicitação.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setSelectedProduct(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isRedeeming} className="gap-2">
                {isRedeeming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                Confirmar Resgate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </UserShell>
  );
}
