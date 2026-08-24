import {
  Gift,
  Image,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import type { NavItem } from "@/components/layout/AppShell";

export const adminNav: NavItem[] = [
  { label: "Visão geral", to: "/admin/dashboard", icon: LayoutDashboard, section: "Administração" },
  { label: "Usuários", to: "/admin/usuarios", icon: Users, section: "Gestão" },
  { label: "Planos", to: "/admin/planos", icon: ShieldCheck, section: "Gestão" },
  { label: "Pagamentos", to: "/admin/pagamentos", icon: Wallet, section: "Financeiro" },
  { label: "Saques", to: "/admin/saques", icon: Gift, section: "Financeiro" },
  { label: "Produtos", to: "/admin/produtos", icon: Package, section: "Loja" },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingCart, section: "Loja" },
  { label: "Banners", to: "/admin/banners", icon: Image, section: "Site" },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings, section: "Sistema" },
];
