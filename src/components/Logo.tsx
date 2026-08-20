import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  const { get } = useSettings();
  const name = get<string>("platform_name", "Arena Saúde");
  const logoUrl = get<string | null>("logo_url", null);

  return (
    <Link to={to} className={cn("flex items-center gap-2.5 min-w-0", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-8 w-auto shrink-0 object-contain" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary">
          <Zap className="h-5 w-5 text-primary-foreground" aria-hidden />
        </span>
      )}
      <span className="truncate text-lg font-bold tracking-tight">{name}</span>
    </Link>
  );
}
