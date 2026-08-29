import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import arenaLogo from "@/assets/arena-logo.png.asset.json";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  const { get } = useSettings();
  const name = get<string>("platform_name", "Arena Suplementos");
  const logoUrl = get<string | null>("logo_url", arenaLogo.url);

  return (
    <Link to={to} className={cn("flex items-center min-w-0", className)}>
      <img src={logoUrl || ""} alt={name} className="h-9 w-auto shrink-0 object-contain" />
    </Link>
  );
}
