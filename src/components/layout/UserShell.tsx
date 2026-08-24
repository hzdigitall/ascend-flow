import { Link } from "@tanstack/react-router";
import {
  Coins,
  Gift,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const items: NavItem[] = [
  { label: "Início", to: "/dashboard", icon: LayoutDashboard, section: "Painel" },
  { label: "Planos", to: "/planos", icon: Sparkles, section: "Painel" },
  { label: "Meus pontos", to: "/pontos", icon: Coins, section: "Painel" },
  { label: "Depositar", to: "/depositar", icon: Wallet, section: "Financeiro" },
  { label: "Carteira", to: "/carteira", icon: Wallet, section: "Financeiro" },
  { label: "Saques", to: "/saques", icon: Gift, section: "Financeiro" },
  { label: "Indicações", to: "/indicacoes", icon: Users, section: "Rede" },
  { label: "Loja de prêmios", to: "/loja", icon: ShoppingBag, section: "Resgates" },
  { label: "Meus pedidos", to: "/pedidos", icon: Package, section: "Resgates" },
  { label: "Minha conta", to: "/conta", icon: UserIcon, section: "Conta" },
];

export function UserShell({ children }: { children: ReactNode }) {
  return (
    <AppShell items={items} variant="user">
      {children}
    </AppShell>
  );
}

export { Link };
