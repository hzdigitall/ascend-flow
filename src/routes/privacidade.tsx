import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Nexora" },
      {
        name: "description",
        content: "Como a Nexora coleta, usa e protege seus dados pessoais conforme a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Nexora" },
      { property: "og:description", content: "Tratamento de dados pessoais na plataforma Nexora." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().toLocaleDateString("pt-BR")}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">Dados que coletamos</h2>
          <p>
            Nome completo, e-mail, telefone/WhatsApp, CPF, chave PIX, endereço de entrega (quando há
            resgate de produto físico) e registros de uso da plataforma.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Como usamos</h2>
          <p>
            Para autenticar seu acesso, processar pagamentos PIX, calcular pontos e comissões,
            executar saques, entregar produtos resgatados, enviar notificações e prevenir fraudes.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Compartilhamento</h2>
          <p>
            Compartilhamos dados apenas com provedores necessários à operação (gateway de pagamento
            PIX, infraestrutura de nuvem e envio de mensagens) e quando exigido por lei.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Segurança</h2>
          <p>
            Utilizamos criptografia em trânsito, controle de acesso por perfil e regras de segurança
            no banco de dados que garantem que cada usuário acesse somente os próprios dados.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, além de
            revogar consentimentos, pelo canal de suporte disponível na plataforma.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Cookies</h2>
          <p>
            Usamos cookies essenciais para manter sua sessão ativa e preferências básicas de uso.
          </p>
        </section>
      </div>

      <Button asChild variant="outline" className="mt-10">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
