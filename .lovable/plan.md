# Plano de Implementação: Arena Saúde

Implementação completa das regras de negócio, branding e funcionalidades descritas no PDF "ARENA - APRESENTAÇÃO", mantendo o layout e fontes atuais do projeto.

## 1. Branding & Identidade Visual
- Renomear a plataforma de **Nexora** para **Arena Saúde**.
- Atualizar a Landing Page (`src/routes/index.tsx`):
    - Título: "Seu Futuro, Nosso Propósito".
    - Subtítulo: "Uma marca criada para transformar escolhas em conquistas. Unimos saúde, qualidade, resultados e transparência."
    - Destaques: Saúde, Bem Estar, Resultados.

## 2. Configurações & Regras de Negócio (Banco de Dados)
- **Taxa de Saque:** Definir como **2%** fixos.
- **Saque de Rendimentos:** Permitido apenas às segundas-feiras, das 10h às 17h (mínimo R$ 10).
- **Saque de Bônus:** Permitido todos os dias, das 09h às 17h (mínimo R$ 10).
- **Pontuação Arena:** R$ 50,00 investidos = 5 Pontos Arena.
- **Voucher de Cadastro:** Bônus de R$ 30,00 automático no primeiro aporte (ex: Plano de R$ 50 custa R$ 20).
- **Limite de Planos:** Máximo de 4 planos ativos do mesmo tipo por usuário.

## 3. Planos & Investimentos
Atualizar e criar os planos conforme a tabela de projeção (dobra em dias úteis):
- **Iniciante:** R$ 50,00 (3,5% ao dia, dobra em 29 dias úteis).
- **Intermediário:** R$ 250,00 (4,5% ao dia, dobra em 23 dias úteis).
- **Avançado:** R$ 500,00 (6,5% ao dia, dobra em 16 dias úteis).
- **Profissional:** R$ 1.000,00 (6,5% ao dia, dobra em 16 dias úteis).
- **Elite:** R$ 5.000,00 (7,5% ao dia, dobra em 14 dias úteis).
- *Nota: Implementar rendimentos diários automáticos via cron/scheduler.*

## 4. Marketing Multinível (8 Níveis)
Expandir o sistema de comissões para 8 níveis de profundidade:
- 1º Nível: 12%
- 2º Nível: 5%
- 3º Nível: 3%
- 4º Nível: 2%
- 5º ao 8º Nível: 1% cada.

## 5. Plano de Carreira
Implementar verificação automática de graduações baseada em pontos e requisitos de rede (ex: Master, Bronze, Prata... até Titan).

## Detalhes Técnicos
- Nova migração SQL para atualizar `settings`, `plans` e a função `confirm_payment` (para os 8 níveis).
- Ajustar `src/lib/app.functions.ts` para validar regras de saque (horários e dias).
- Atualizar `src/routes/_authenticated/planos.tsx` e `dashboard.tsx` com as novas informações.
