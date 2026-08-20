import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Arena Saúde" },
      { name: "description", content: "Condições de uso da plataforma Arena Saúde: planos, pontos, indicações e resgates." },
      { property: "og:title", content: "Termos de Uso — Arena Saúde" },
      { property: "og:description", content: "Leia as condições de uso da plataforma Arena Saúde." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().toLocaleDateString("pt-BR")}
      </p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Aceitação</h2>
          <p>
            Ao criar uma conta você concorda com estes Termos. Caso não concorde, não utilize a
            plataforma.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">2. Conta e cadastro</h2>
          <p>
            Você é responsável pela veracidade dos dados informados (nome, CPF, telefone e e-mail) e
            pela guarda das suas credenciais de acesso. Contas com dados falsos podem ser bloqueadas.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">3. Planos e pagamentos</h2>
          <p>
            Os planos são adquiridos via PIX. A ativação ocorre após a confirmação do pagamento pelo
            provedor. Valores, benefícios e pontuações são definidos no painel administrativo e podem
            ser alterados a qualquer momento, sem efeito retroativo sobre planos já ativos.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">4. Pontos e resgates</h2>
          <p>
            Pontos são créditos de uso interno, sem valor monetário, e podem ser trocados por produtos
            do catálogo enquanto houver estoque. Pontos podem expirar conforme regras vigentes.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">5. Indicações e comissões</h2>
          <p>
            Comissões são creditadas conforme os percentuais configurados por nível e apenas sobre
            pagamentos efetivamente confirmados. Fraudes, autoindicação ou cadastros duplicados
            resultam em estorno e bloqueio.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">6. Saques</h2>
          <p>
            Saques são solicitados via chave PIX cadastrada em nome do titular da conta, respeitando o
            valor mínimo e os prazos de análise informados na plataforma.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">7. Condutas proibidas</h2>
          <p>
            É vedado usar a plataforma para fraude, lavagem de dinheiro, spam, engenharia reversa ou
            qualquer atividade ilícita.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">8. Encerramento</h2>
          <p>
            Podemos suspender ou encerrar contas que violem estes Termos. Você pode solicitar a
            exclusão da sua conta a qualquer momento pelo suporte.
          </p>
        </section>
      </div>

      <Button asChild variant="outline" className="mt-10">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
