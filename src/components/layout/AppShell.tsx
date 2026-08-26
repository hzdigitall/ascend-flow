import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Logo } from "@/components/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type NavItem = { label: string; to: string; icon: LucideIcon; section?: string };

// ─── Memoized sidebar nav links ───────────────────────────────────────────────

interface SidebarNavProps {
  items: NavItem[];
  pathname: string;
  variant: "user" | "admin";
  onNavigate: () => void;
}

const SidebarNav = ({ items, pathname, variant, onNavigate }: SidebarNavProps) => {
  const sections = useMemo(() => [...new Set(items.map((i) => i.section ?? ""))], [items]);

  return (
    <nav className="flex-1 space-y-5" aria-label="Navegação principal">
      {sections.map((section) => (
        <div key={section} className="space-y-1">
          {section ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section}
            </p>
          ) : null}
          {items
            .filter((i) => (i.section ?? "") === section)
            .map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  prefetch="intent"
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
        </div>
      ))}

      {variant === "user" && (
        <Link
          to="/admin/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl bg-primary-soft px-3 py-2.5 text-sm font-medium text-primary"
          prefetch="intent"
        >
          <Shield className="h-4.5 w-4.5" aria-hidden />
          Painel administrativo
        </Link>
      )}
      {variant === "admin" && (
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          prefetch="intent"
        >
          <LayoutDashboard className="h-4.5 w-4.5" aria-hidden />
          Voltar para minha conta
        </Link>
      )}
    </nav>
  );
};

// ─── Memoized sponsor card ─────────────────────────────────────────────────────

interface SponsorCardProps {
  sponsor: { full_name: string; phone?: string | null; avatar_url?: string | null } | null;
  onNavigate: () => void;
}

const SponsorCard = ({ sponsor, onNavigate }: SponsorCardProps) => {
  if (!sponsor) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Seu patrocinador
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={sponsor.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary-soft text-xs text-primary">
            {initials(sponsor.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-sm font-medium">{sponsor.full_name}</span>
      </div>
      {sponsor.phone ? (
        <Button asChild variant="outline" size="sm" className="mt-3 w-full" onClick={onNavigate}>
          <a
            href={`https://wa.me/55${sponsor.phone.replace(/\D+/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
};

// ─── Memoized user dropdown ───────────────────────────────────────────────────

interface UserMenuProps {
  profile: ReturnType<typeof useAuth>["profile"];
  isAdmin: boolean;
  onSignOut: () => void;
}

const UserMenu = ({ profile, isAdmin, onSignOut }: UserMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted"
        aria-label="Abrir menu do usuário"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-brand text-xs text-primary-foreground">
            {initials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-semibold">
            {profile?.full_name || "Minha conta"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{profile?.email}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuLabel className="truncate">{profile?.email}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/conta">
          <UserIcon className="mr-2 h-4 w-4" /> Minha conta
        </Link>
      </DropdownMenuItem>
      {isAdmin ? (
        <DropdownMenuItem asChild>
          <Link to="/admin/dashboard">
            <Shield className="mr-2 h-4 w-4" /> Painel administrativo
          </Link>
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ─── Main AppShell ────────────────────────────────────────────────────────────

export function AppShell({
  items,
  children,
  variant = "user",
}: {
  items: NavItem[];
  children: ReactNode;
  variant?: "user" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const { get } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleNavigate = useCallback(() => setOpen(false), []);
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  }, [signOut, navigate]);
  const handleOpenMenu = useCallback(() => setOpen(true), []);
  const handleCloseMenu = useCallback(() => setOpen(false), []);

  // Sponsor data — longer staleTime to reduce re-fetching
  const { data: sponsor } = useQuery({
    queryKey: ["sponsor", profile?.sponsor_id],
    enabled: Boolean(profile?.sponsor_id),
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_sponsor");
      return data?.[0] ?? null;
    },
  });

  // Support links — read once, don't re-render
  const supportWhats = useMemo(() => get<string>("support_whatsapp", ""), [get]);
  const supportEmail = useMemo(() => get<string>("support_email", ""), [get]);
  const supportLink = useMemo(() => get<string>("support_link", ""), [get]);
  const supportHref = useMemo(
    () =>
      supportLink
        ? supportLink
        : supportWhats
          ? `https://wa.me/${supportWhats}`
          : supportEmail
            ? `mailto:${supportEmail}`
            : null,
    [supportLink, supportWhats, supportEmail],
  );

  // Memoized sidebar content — never re-renders on route changes
  const sidebar = useMemo(
    () => (
      <div className="flex h-full flex-col gap-6 overflow-y-auto bg-sidebar px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <Logo to={variant === "admin" ? "/admin/dashboard" : "/dashboard"} />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={handleCloseMenu}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <SidebarNav
          items={items}
          pathname={pathname}
          variant={variant}
          onNavigate={handleNavigate}
        />

        <SponsorCard sponsor={sponsor ?? null} onNavigate={handleNavigate} />

        {supportHref ? (
          <Button asChild variant="secondary" size="sm" className="w-full">
            <a href={supportHref} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> Falar com suporte
            </a>
          </Button>
        ) : null}
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pathname,
      sponsor,
      supportHref,
      variant,
      items.length, // only re-render if nav items count changes
    ],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        {sidebar}
      </aside>

      {/* Mobile overlay + drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={handleCloseMenu}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r shadow-xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Main content area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={handleOpenMenu}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="lg:hidden">
            <Logo to={variant === "admin" ? "/admin/dashboard" : "/dashboard"} />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* NotificationsBell loads async — won't block header render */}
            <NotificationsBell userId={profile?.id} />

            <UserMenu
              profile={profile}
              isAdmin={isAdmin}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
