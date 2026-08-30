import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, HeartHandshake, Sparkles, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import ceoAlicia from "@/assets/ceo-alicia.png";

export const Route = createFileRoute("/quem-somos")({
  head: () => ({
    meta: [
      { title: "Quem Somos — Arena Suplementos" },
      {
        name: "description",
        content:
          "Conheça a Arena Suplementos: uma marca brasileira que une suplementos premium, tecnologia e oportunidade para transformar escolhas em conquistas.",
      },
      { property: "og:title", content: "Quem Somos — Arena Suplementos" },
      {
        property: "og:description",
        content: "História, propósito e liderança da Arena Suplementos.",
      },
      { property: "og:url", content: "https://arenasuplementos.com/quem-somos" },
    ],
    links: [{ rel: "canonical", href: "https://arenasuplementos.com/quem-somos" }],
  }),
  component: AboutPage,
});

const content = {
  pt: {
    badge: "Quem somos",
    title: "Saúde, propósito e oportunidade no mesmo lugar.",
    intro:
      "A Arena Suplementos nasceu de uma convicção simples: cuidar da saúde e construir o futuro não deveriam ser caminhos separados. Somos uma marca brasileira que une suplementos premium, tecnologia e um modelo de participação que recompensa quem cresce junto com a gente.",
    missionTitle: "Nosso propósito",
    mission:
      "Transformar escolhas em conquistas. Cada produto, cada ponto e cada indicação dentro da Arena foi pensado para que o participante evolua — na saúde, na renda e na vida.",
    pillarsTitle: "No que acreditamos",
    pillars: [
      {
        icon: Sparkles,
        title: "Qualidade de verdade",
        text: "Nossa linha Glow, Shape, Mind e Burn é desenvolvida com ciência, nutrição e tecnologia. Nada de promessa vazia: produto bom se prova no resultado.",
      },
      {
        icon: HeartHandshake,
        title: "Transparência",
        text: "Regras claras, percentuais públicos e suporte que responde. Você sempre sabe onde está e o que esperar da plataforma.",
      },
      {
        icon: Target,
        title: "Crescimento compartilhado",
        text: "Indicação em 8 níveis, pontos que viram prêmios e um plano de carreira do Master ao Titan. Quando a rede cresce, todo mundo evolui junto.",
      },
    ],
    ceoBadge: "Nossa liderança",
    ceoRole: "CEO · Arena Suplementos",
    ceoBio:
      "Fundadora e responsável por guiar a visão da Arena Suplementos, Alicia Franco acredita que saúde, propósito e oportunidade caminham juntos. Sob sua liderança, a marca une produtos premium, um ecossistema de pontos e um plano de carreira para transformar escolhas em conquistas reais na vida de cada participante.",
    ceoQuote:
      "\"Nosso propósito é construir um futuro onde cada pessoa tem acesso à saúde e à oportunidade de crescer.\"",
    cta: "Fazer parte da Arena",
    back: "Voltar ao início",
  },
  en: {
    badge: "Who we are",
    title: "Health, purpose and opportunity in one place.",
    intro:
      "Arena Suplementos was born from a simple conviction: taking care of your health and building your future shouldn't be separate paths. We are a Brazilian brand that combines premium supplements, technology and a participation model that rewards those who grow with us.",
    missionTitle: "Our purpose",
    mission:
      "Turning choices into achievements. Every product, every point and every referral inside Arena was designed so that each participant evolves — in health, in income and in life.",
    pillarsTitle: "What we believe in",
    pillars: [
      {
        icon: Sparkles,
        title: "Real quality",
        text: "Our Glow, Shape, Mind and Burn lines are developed with science, nutrition and technology. No empty promises: a good product proves itself in results.",
      },
      {
        icon: HeartHandshake,
        title: "Transparency",
        text: "Clear rules, public rates and support that actually answers. You always know where you stand and what to expect from the platform.",
      },
      {
        icon: Target,
        title: "Shared growth",
        text: "8-level referrals, points that become rewards and a career plan from Master to Titan. When the network grows, everyone evolves together.",
      },
    ],
    ceoBadge: "Our leadership",
    ceoRole: "CEO · Arena Suplementos",
    ceoBio:
      "Founder and the driving force behind Arena Suplementos, Alicia Franco believes health, purpose and opportunity go hand in hand. Under her leadership, the brand combines premium products, a points ecosystem and a career plan to turn choices into real achievements for every participant.",
    ceoQuote:
      "\"Our purpose is to build a future where everyone has access to health and the opportunity to grow.\"",
    cta: "Join Arena",
    back: "Back to home",
  },
};

function AboutPage() {
  const { lang, t } = useI18n();
  const c = content[lang];

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

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
          <Crown className="h-3.5 w-3.5" aria-hidden /> {c.badge}
        </span>
        <h1 className="mt-6 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {c.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {c.intro}
        </p>

        <Card className="mt-12 border-primary/20 bg-primary-soft shadow-card">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-primary">{c.missionTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground sm:text-base">
              {c.mission}
            </p>
          </CardContent>
        </Card>

        <h2 className="mt-14 text-2xl font-bold tracking-tight sm:text-3xl">{c.pillarsTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.pillars.map((p) => (
            <Card key={p.title} className="shadow-card">
              <CardContent className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-14 overflow-hidden shadow-card">
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
                <Crown className="h-3.5 w-3.5" aria-hidden /> {c.ceoBadge}
              </span>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Alicia Franco
                </h2>
                <p className="mt-1 text-sm font-semibold text-primary">{c.ceoRole}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {c.ceoBio}
              </p>
              <p className="text-sm font-semibold text-foreground">{c.ceoQuote}</p>
            </CardContent>
          </div>
        </Card>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/cadastro">{c.cta}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/">{c.back}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
