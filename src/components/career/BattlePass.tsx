import { Crown, Lock, Check, Users, CalendarClock, Sparkle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pts as formatPoints, brl } from "@/lib/format";

export type PassRank = {
  name: string;
  points: number;
  bonus: number;
  req?: string | undefined;
};

/** Barra rosa com animação de água que enche conforme os pontos do BLA. */
export function WaterBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "relative h-8 w-full overflow-hidden rounded-full border border-primary/25 bg-muted/60",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      >
        {/* corpo da água */}
        <div className="absolute inset-0 bg-gradient-brand opacity-95" />
        {/* ondas */}
        <div className="absolute inset-y-0 left-0 w-[200%] animate-wave opacity-60">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="h-full w-full">
            <path
              d="M0 22 C 150 6, 300 38, 450 22 C 600 6, 750 38, 900 22 C 1050 6, 1125 30, 1200 22 L1200 40 L0 40 Z"
              fill="currentColor"
              className="text-primary-foreground/25"
            />
          </svg>
        </div>
        <div className="absolute inset-y-0 left-0 w-[200%] animate-wave-slow opacity-40">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="h-full w-full">
            <path
              d="M0 26 C 200 40, 400 10, 600 26 C 800 42, 1000 12, 1200 26 L1200 40 L0 40 Z"
              fill="currentColor"
              className="text-primary-foreground/20"
            />
          </svg>
        </div>
        {/* bolhas */}
        <span className="absolute bottom-1 left-[18%] h-1.5 w-1.5 animate-bubble rounded-full bg-primary-foreground/60" />
        <span
          className="absolute bottom-1 left-[52%] h-1 w-1 animate-bubble rounded-full bg-primary-foreground/50"
          style={{ animationDelay: "1.1s" }}
        />
        <span
          className="absolute bottom-1 left-[78%] h-1.5 w-1.5 animate-bubble rounded-full bg-primary-foreground/40"
          style={{ animationDelay: "2.1s" }}
        />
        {/* brilho / shading */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0)_45%,rgba(0,0,0,0.18))]" />
        <div className="pointer-events-none absolute inset-y-0 w-1/4 animate-shine bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[11px] font-black uppercase tracking-wider text-foreground mix-blend-luminosity">
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

type Props = {
  ranks: PassRank[];
  currentPoints: number;
  currentRankName: string | null;
  qualifiedRankName: string | null;
  nextRank: PassRank | undefined;
  periodLabel: string;
  network: { directs: number; total: number; active: number };
  daysToPayout: number;
};

export function BattlePass({
  ranks,
  currentPoints,
  currentRankName,
  qualifiedRankName,
  nextRank,
  periodLabel,
  network,
  daysToPayout,
}: Props) {
  const top = ranks[ranks.length - 1];
  const overall = top ? Math.min((currentPoints / top.points) * 100, 100) : 0;
  const nextProgress = nextRank ? Math.min((currentPoints / nextRank.points) * 100, 100) : 100;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/25 shadow-card">
        <div className="relative bg-gradient-secondary p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(251,9,110,0.45),transparent_60%)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary-foreground/70">
                Passe de Carreira Arena
              </p>
              <h3 className="text-3xl font-black text-primary-foreground">
                {currentRankName ?? "Sem graduação"}
              </h3>
              <p className="text-sm text-primary-foreground/80">
                {formatPoints(currentPoints)} em {periodLabel}
              </p>
            </div>
            <div className="animate-bob rounded-2xl border border-primary-foreground/20 bg-background/10 px-5 py-4 text-center backdrop-blur">
              <Crown className="mx-auto h-7 w-7 text-primary-foreground" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground/70">
                BLA deste mês
              </p>
              <p className="text-xl font-black text-primary-foreground">
                {qualifiedRankName
                  ? brl(ranks.find((r) => r.name === qualifiedRankName)?.bonus ?? 0)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="relative mt-6 space-y-2">
            <WaterBar value={overall} />
            <div className="flex justify-between text-[11px] font-semibold text-primary-foreground/80">
              <span>{formatPoints(currentPoints)}</span>
              <span>{top ? `${formatPoints(top.points)} · ${top.name}` : ""}</span>
            </div>
          </div>
        </div>

        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider">Minha rede</p>
            </div>
            <p className="mt-1 text-2xl font-black">{network.total}</p>
            <p className="text-xs text-muted-foreground">
              {network.directs} diretos · {network.active} ativos
            </p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <Sparkle className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider">Próximo elo</p>
            </div>
            <p className="mt-1 text-lg font-black">{nextRank?.name ?? "Máximo"}</p>
            <p className="text-xs text-muted-foreground">
              Faltam {formatPoints(Math.max((nextRank?.points ?? 0) - currentPoints, 0))}
              {nextRank?.req ? ` e ${nextRank.req} na equipe direta` : ""}
            </p>
            <div className="mt-3">
              <WaterBar value={nextProgress} className="h-4" />
            </div>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <CalendarClock className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider">Pagamento do BLA</p>
            </div>
            <p className="mt-1 text-2xl font-black">Dia 15</p>
            <p className="text-xs text-muted-foreground">
              {daysToPayout === 0
                ? "O pagamento é hoje."
                : daysToPayout === 1
                  ? "Falta 1 dia para o pagamento."
                  : `Faltam ${daysToPayout} dias para o pagamento.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h3 className="font-bold">Trilha de elos</h3>
              <p className="text-xs text-muted-foreground">
                Cada elo desbloqueia um valor mensal de BLA.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto p-6">
            <div className="flex min-w-max items-end gap-4">
              {ranks.map((rank, i) => {
                const unlocked = currentPoints >= rank.points;
                const isCurrent = currentRankName === rank.name;
                const fill = Math.min((currentPoints / rank.points) * 100, 100);
                return (
                  <div key={rank.name} className="flex items-end gap-4">
                    <div
                      className={cn(
                        "w-[150px] shrink-0 rounded-2xl border p-4 text-center transition-all",
                        unlocked
                          ? "border-primary/40 bg-primary/10 shadow-card"
                          : "border-border bg-muted/40",
                        isCurrent && "ring-2 ring-primary",
                      )}
                    >
                      <div
                        className={cn(
                          "mx-auto grid h-12 w-12 place-items-center rounded-full border-2",
                          unlocked
                            ? "animate-bob border-primary bg-gradient-brand text-primary-foreground"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {unlocked ? <Check className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                      </div>
                      <p className="mt-3 text-sm font-black uppercase leading-tight">{rank.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatPoints(rank.points)}
                      </p>
                      {rank.req && (
                        <p className="text-[10px] text-muted-foreground">{rank.req}</p>
                      )}
                      <p className="mt-2 text-sm font-black text-primary">{brl(rank.bonus)}</p>
                      <div className="mt-3">
                        <WaterBar value={fill} className="h-3" />
                      </div>
                    </div>
                    {i < ranks.length - 1 && (
                      <div
                        className={cn(
                          "mb-16 h-1 w-6 rounded-full",
                          unlocked ? "bg-primary" : "bg-border",
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
