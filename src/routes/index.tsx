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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OrbitalSphereBackground from "@/components/ui/orbital-sphere";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena Saúde — Seu futuro, nosso propósito" },
      {
        name: "description",
        content:
          "Produtos premium, pontos Arena, indicação em 8 níveis e plano de carreira. Transforme escolhas em conquistas com a Arena Saúde.",
      },
      { property: "og:title", content: "Arena Saúde — Seu futuro, nosso propósito" },
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
  {
    icon: Sparkles,
    title: "Mais que suplementos",
    text: "Linha premium (Glow, Shape, Mind e Burn) com ciência, nutrição e tecnologia.",
  },
  {
    icon: Coins,
    title: "Pontos & benefícios",
    text: "A cada R$ 50,00 investidos você recebe 5 pontos Arena para trocar por prêmios.",
  },
  {
    icon: Users,
    title: "Indicação em 8 níveis",
    text: "12% no 1º nível, 5%, 3%, 2% e 1% do 5º ao 8º nível.",
  },
  {
    icon: Crown,
    title: "Plano de carreira",
    text: "De Master (R$ 300/mês) até Titan (R$ 25.000/mês) por pontos e rede.",
  },
];

const plans = [
  { name: "Iniciante", price: "R$ 50", rate: "3,50%", days: "29 dias úteis", total: "R$ 100" },
  { name: "Intermediário", price: "R$ 250", rate: "4,50%", days: "23 dias úteis", total: "R$ 500" },
  { name: "Avançado", price: "R$ 500", rate: "6,50%", days: "16 dias úteis", total: "R$ 1.000" },
  { name: "Profissional", price: "R$ 1.000", rate: "6,50%", days: "16 dias úteis", total: "R$ 2.000" },
  { name: "Elite", price: "R$ 5.000", rate: "7,50%", days: "14 dias úteis", total: "R$ 10.000" },
];

const rules = [
  "Ativação via PIX ou USDT BEP20",
  "Até 4 vezes o mesmo plano por participante",
  "Taxa de saque: 2%",
  "Rendimentos: segundas-feiras, 10h às 17h (a partir de R$ 10)",
  "Bônus: todos os dias, 9h às 17h (a partir de R$ 10)",
  "Liberação imediata após confirmação",
];

const reasons = [
  "Produtos originais e certificados",
  "Sistema de pontos e benefícios",
  "Programa de indicação",
  "Plano de carreira e reconhecimento",
  "Suporte dedicado",
  "Benefícios exclusivos",
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Logo />
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/cadastro">Criar conta</Link>
          </Button>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <OrbitalSphereBackground className="opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Saúde · Bem Estar · Resultados
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Seu futuro, <span className="text-primary">nosso propósito</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Uma marca criada para transformar escolhas em conquistas. Unimos saúde, qualidade,
          resultados, transparência e oportunidade em um só ecossistema.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/cadastro">Começar agora</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft p-4 text-left">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-foreground">
            <strong>Bônus de R$ 30 no cadastro:</strong> o plano mínimo é R$ 50 e você deposita
            apenas R$ 20 no primeiro aporte.
          </p>
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
                <h2 className="mt-4 text-base font-bold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Escolha seu plano | Ative | Participe
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Todos os planos rendem até dobrar o investimento.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((p) => (
            <Card key={p.name} className="shadow-card">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {p.name}
                </p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight">{p.price}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> {p.rate} ao dia
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Dobra em {p.days}</p>
                <p className="mt-1 text-xs text-muted-foreground">Rende até {p.total}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Projeções baseadas em percentuais diários; podem variar conforme as condições de mercado.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Regras e condições
              </h2>
              <ul className="mt-4 space-y-2.5">
                {rules.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                <Crown className="h-5 w-5 text-primary" aria-hidden /> Por que fazer parte
              </h2>
              <ul className="mt-4 space-y-2.5">
                {reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm font-semibold">
                Na Arena, você não apenas participa. Você evolui.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Na Arena, você não tem limites. Você tem destino.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm opacity-90">
            Construa sua jornada, evolua com a Arena e transforme escolhas em conquistas.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/cadastro">Fazer parte da Arena</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Arena Saúde</span>
          <nav className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
