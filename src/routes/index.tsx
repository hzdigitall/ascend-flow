import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena Saúde — Seu futuro, nosso propósito" },
      {
        name: "description",
        content:
          "Transforme escolhas em conquistas com a Arena Saúde. Saúde, bem estar e resultados através de produtos premium e oportunidades reais.",
      },
      { property: "og:title", content: "Arena Saúde — Seu futuro, nosso propósito" },
      {
        property: "og:description",
        content: "Saúde, bem estar e resultados através de produtos premium.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Sparkles, title: "Planos com PIX", text: "Pagamento instantâneo e ativação automática." },
  { icon: Coins, title: "Pontos em tempo real", text: "Acompanhe cada crédito no seu extrato." },
  { icon: Users, title: "Indicações por níveis", text: "Comissões automáticas na sua rede." },
  { icon: ShieldCheck, title: "Dados protegidos", text: "Cada usuário acessa somente o que é seu." },
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

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Pagamentos PIX em segundos
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Seus planos, <span className="text-gradient-brand">seus pontos</span>, suas recompensas.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Uma plataforma completa para ativar planos, acompanhar ganhos e indicações e trocar pontos
          por produtos reais.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/cadastro">Começar agora</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="shadow-card">
              <CardContent className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-bold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Nexora</span>
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
