import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Perguntas Frequentes — Arena Suplementos" },
      {
        name: "description",
        content:
          "Tire suas dúvidas sobre planos, rendimentos, saques, indicações e pontos da Arena Suplementos.",
      },
      { property: "og:title", content: "Perguntas Frequentes — Arena Suplementos" },
      {
        property: "og:description",
        content: "Respostas diretas sobre como funciona a Arena Suplementos.",
      },
      { property: "og:url", content: "https://arenasuplementos.com/faq" },
    ],
    links: [{ rel: "canonical", href: "https://arenasuplementos.com/faq" }],
  }),
  component: FaqPage,
});

type FaqItem = { q: string; a: string };

const content = {
  pt: {
    title: "Perguntas Frequentes",
    subtitle: "As dúvidas mais comuns de quem está começando na Arena, respondidas de forma direta.",
    back: "Voltar ao início",
    cta: "Criar minha conta",
    items: [
      {
        q: "Como começo a participar?",
        a: "Crie sua conta gratuitamente e escolha um plano a partir de R$ 50. No primeiro aporte você já ganha um bônus de R$ 30: ou seja, no plano mínimo você deposita apenas R$ 20. O pagamento é feito por PIX ou USDT BEP20 e a ativação acontece assim que o pagamento é confirmado.",
      },
      {
        q: "Quando o rendimento cai na minha conta?",
        a: "O rendimento diário do seu plano é creditado 24 horas após a ativação e continua sendo creditado a cada ciclo, até atingir 200% do valor investido. O percentual varia de 3,5% a 7,5% ao dia conforme o plano escolhido.",
      },
      {
        q: "Como funcionam os saques?",
        a: "Os saques têm taxa de 2% e valor mínimo de R$ 10. O saldo de rendimentos pode ser sacado às segundas-feiras, das 10h às 17h. Já o saldo de bônus e comissões fica disponível todos os dias, das 9h às 17h. Tudo no horário de Brasília, direto na sua chave PIX.",
      },
      {
        q: "Como funciona o programa de indicação?",
        a: "Cada participante tem um link exclusivo de indicação. Quando alguém se cadastra pelo seu link e ativa um plano, você recebe comissão em até 8 níveis: 12% no 1º nível, 5% no 2º, 3% no 3º, 2% no 4º e 1% do 5º ao 8º nível, sempre sobre pagamentos confirmados.",
      },
      {
        q: "O que são os Pontos Arena?",
        a: "A cada R$ 50 investidos — por você ou por um indicado direto — você ganha 5 Pontos Arena. Eles podem ser trocados por produtos da loja de prêmios, como Arena Glow, Shape, Mind e Burn, e também contam para o seu plano de carreira, que vai de Master a Titan.",
      },
    ] satisfies FaqItem[],
  },
  en: {
    title: "Frequently Asked Questions",
    subtitle: "The most common questions from people getting started at Arena, answered directly.",
    back: "Back to home",
    cta: "Create my account",
    items: [
      {
        q: "How do I get started?",
        a: "Create your free account and choose a plan starting at R$ 50. On your first contribution you get a R$ 30 bonus — so on the minimum plan you only deposit R$ 20. Payment is made via PIX or USDT BEP20 and activation happens as soon as the payment is confirmed.",
      },
      {
        q: "When are earnings credited to my account?",
        a: "Your plan's daily yield is credited 24 hours after activation and keeps being credited every cycle until it reaches 200% of the invested amount. The rate ranges from 3.5% to 7.5% per day depending on the plan you choose.",
      },
      {
        q: "How do withdrawals work?",
        a: "Withdrawals have a 2% fee and a R$ 10 minimum. Earnings balance can be withdrawn on Mondays, from 10am to 5pm. Bonus and commission balance is available every day, from 9am to 5pm. All times are Brasília time, paid straight to your PIX key.",
      },
      {
        q: "How does the referral program work?",
        a: "Every participant gets an exclusive referral link. When someone signs up through your link and activates a plan, you earn commission across up to 8 levels: 12% on level 1, 5% on level 2, 3% on level 3, 2% on level 4 and 1% from level 5 to 8, always on confirmed payments.",
      },
      {
        q: "What are Arena Points?",
        a: "For every R$ 50 invested — by you or a direct referral — you earn 5 Arena Points. They can be redeemed for products in the rewards store, like Arena Glow, Shape, Mind and Burn, and they also count toward your career plan, from Master to Titan.",
      },
    ] satisfies FaqItem[],
  },
};

function FaqPage() {
  const { lang, t } = useI18n();
  const c = content[lang];
  const [open, setOpen] = useState<number | null>(0);

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

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h1>
        <p className="mt-3 text-muted-foreground">{c.subtitle}</p>

        <div className="mt-10 space-y-3">
          {c.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="rounded-xl border bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

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
