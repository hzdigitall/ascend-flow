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
import { useMemo, type ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { useI18n } from "@/lib/i18n";

export function UserShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  const items = useMemo<NavItem[]>(
    () => [
      { label: t("nav.home"), to: "/dashboard", icon: LayoutDashboard, section: t("nav.section.panel") },
      { label: t("nav.plans"), to: "/planos", icon: Sparkles, section: t("nav.section.panel") },
      { label: t("nav.points"), to: "/pontos", icon: Coins, section: t("nav.section.panel") },
      { label: t("nav.deposit"), to: "/depositar", icon: Wallet, section: t("nav.section.finance") },
      { label: t("nav.wallet"), to: "/carteira", icon: Wallet, section: t("nav.section.finance") },
      { label: t("nav.withdrawals"), to: "/saques", icon: Gift, section: t("nav.section.finance") },
      { label: t("nav.referrals"), to: "/indicacoes", icon: Users, section: t("nav.section.network") },
      { label: t("nav.store"), to: "/loja", icon: ShoppingBag, section: t("nav.section.rewards") },
      { label: t("nav.orders"), to: "/pedidos", icon: Package, section: t("nav.section.rewards") },
      { label: t("nav.account"), to: "/conta", icon: UserIcon, section: t("nav.section.account") },
    ],
    [t],
  );

  return (
    <AppShell items={items} variant="user">
      {children}
    </AppShell>
  );
}

export { Link };
