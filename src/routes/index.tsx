import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Coins,
  Crown,
  Gift,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OrbitalSphereBackground from "@/components/ui/orbital-sphere";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/locales";
import ceoAlicia from "@/assets/ceo-alicia.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena Suplementos — Seu futuro, nosso propósito" },
      {
        name: "description",
        content:
          "Produtos premium, pontos Arena, indicação em 8 níveis e plano de carreira. Transforme escolhas em conquistas com a Arena Suplementos.",
      },
      { property: "og:title", content: "Arena Suplementos — Seu futuro, nosso propósito" },
      {
        property: "og:description",
        content:
          "Saúde, bem estar e resultados: planos, pontos, indicação em 8 níveis e plano de carreira.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  { icon: Sparkles, title: "home.pillar1.title", text: "home.pillar1.text" },
  { icon: Coins, title: "home.pillar2.title", text: "home.pillar2.text" },
  { icon: Users, title: "home.pillar3.title", text: "home.pillar3.text" },
  { icon: Crown, title: "home.pillar4.title", text: "home.pillar4.text" },
] satisfies { icon: typeof Sparkles; title: TranslationKey; text: TranslationKey }[];

const plans = [
  { name: "home.plan.beginner", price: "R$ 50", rate: "3,50%", days: "home.days.29", total: "R$ 100" },
  { name: "home.plan.intermediate", price: "R$ 250", rate: "4,50%", days: "home.days.23", total: "R$ 500" },
  { name: "home.plan.advanced", price: "R$ 500", rate: "6,50%", days: "home.days.16", total: "R$ 1.000" },
  { name: "home.plan.professional", price: "R$ 1.000", rate: "6,50%", days: "home.days.16", total: "R$ 2.000" },
  { name: "home.plan.elite", price: "R$ 5.000", rate: "7,50%", days: "home.days.14", total: "R$ 10.000" },
] satisfies { name: TranslationKey; price: string; rate: string; days: TranslationKey; total: string }[];

const rules: TranslationKey[] = [
  "home.rule1",
  "home.rule2",
  "home.rule3",
  "home.rule4",
  "home.rule5",
  "home.rule6",
];

const reasons: TranslationKey[] = [
  "home.why1",
  "home.why2",
  "home.why3",
  "home.why4",
  "home.why5",
  "home.why6",
];

function Landing() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Logo />
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <Button asChild variant="ghost">
            <Link to="/login">{t("common.login")}</Link>
          </Button>
          <Button asChild>
            <Link to="/cadastro">{t("common.signup")}</Link>
          </Button>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <OrbitalSphereBackground className="opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {t("home.badge")}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {t("home.title1")} <span className="text-primary">{t("home.title2")}</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("home.subtitle")}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/cadastro">{t("home.cta.start")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">{t("home.cta.have")}</Link>
            </Button>
          </div>

          <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft p-4 text-left">
            <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm text-foreground">
              <strong>{t("home.bonus.strong")}</strong>
              {t("home.bonus.rest")}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((f) => (
            <Card key={f.title} className="shadow-card">
              <CardContent className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-base font-bold">{t(f.title)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t(f.text)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Card className="overflow-hidden shadow-card">
          <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
            <div className="relative aspect-[4/5] w-full bg-muted lg:aspect-auto lg:h-full">
              <img
                src={ceoAlicia}
                alt="Alicia Franco, CEO da Arena Suplementos"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <CardContent className="flex flex-col justify-center gap-4 p-6 sm:p-10">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Crown className="h-3.5 w-3.5" aria-hidden /> {t("home.ceo.badge")}
              </span>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Alicia Franco
                </h2>
                <p className="mt-1 text-sm font-semibold text-primary">{t("home.ceo.role")}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("home.ceo.bio")}
              </p>
              <p className="text-sm font-semibold text-foreground">{t("home.ceo.quote")}</p>
            </CardContent>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("home.plans.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("home.plans.subtitle")}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((p) => (
            <Card key={p.name} className="shadow-card">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t(p.name)}
                </p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight">{p.price}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> {p.rate}{" "}
                  {t("home.plans.perDay")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("home.plans.doubles", { days: t(p.days) })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("home.plans.yields", { total: p.total })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("home.plans.disclaimer")}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> {t("home.rules.title")}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {rules.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{t(r)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <Crown className="h-5 w-5 text-primary" aria-hidden /> {t("home.why.title")}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{t(r)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm font-semibold">{t("home.why.footer")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("home.final.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm opacity-90">{t("home.final.text")}</p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/cadastro">{t("home.final.cta")}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Arena Suplementos</span>
          <nav className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">
              {t("common.terms")}
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              {t("common.privacy")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
