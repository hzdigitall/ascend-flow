import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  pending: "Pendente",
  reviewing: "Em análise",
  processing: "Processando",
  paid: "Pago",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Estornado",
  active: "Ativo",
  completed: "Concluído",
  failed: "Falhou",
  placed: "Pedido realizado",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
};

const TONES: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  reviewing: "bg-warning/15 text-warning-foreground border-warning/30",
  processing: "bg-primary-soft text-primary border-primary/20",
  paid: "bg-success/12 text-success border-success/25",
  active: "bg-success/12 text-success border-success/25",
  completed: "bg-success/12 text-success border-success/25",
  delivered: "bg-success/12 text-success border-success/25",
  shipped: "bg-primary-soft text-primary border-primary/20",
  preparing: "bg-primary-soft text-primary border-primary/20",
  placed: "bg-primary-soft text-primary border-primary/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
  expired: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONES[status] ?? "bg-muted text-muted-foreground")}>
      {LABELS[status] ?? status}
    </Badge>
  );
}

export const statusLabel = (status: string) => LABELS[status] ?? status;
