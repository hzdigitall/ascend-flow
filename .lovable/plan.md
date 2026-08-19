# Plano de Implementação: Arena Saúde

Implementação da identidade visual e regras de negócio da Arena Saúde, conforme o PDF de apresentação.

## Alterações Visuais (Branding)
- Renomear a plataforma de **Nexora** para **Arena Saúde**.
- Atualizar títulos, descrições e meta tags de SEO em todas as rotas.
- Ajustar textos da Landing Page para refletir o propósito: "Seu Futuro, Nosso Propósito" e "Saúde, Bem Estar, Resultados".

## Regras de Negócio & Banco de Dados
- **Planos:**
  - Atualizar os planos existentes e adicionar os novos conforme a tabela (Iniciante R$ 50, Intermediário R$ 250, Avançado R$ 500, Profissional R$ 1000, Elite R$ 5000).
  - Configurar rendimento diário (ROI) variável por plano (3,5% a 7,5%).
  - Implementar lógica de "Dobra" (todos os planos rendem até 200%).
  - Limite de até 4 planos iguais por usuário.
- **Indicações & Comissões:**
  - Expandir o sistema de comissões de 3 níveis para **8 níveis** (12%, 5%, 3%, 2%, 1%, 1%, 1%, 1%).
- **Financeiro:**
  - Taxa de saque: **2%**.
  - Saque de rendimentos: Mínimo R$ 10, às segundas-feiras (10h-17h).
  - Saque de bônus: Mínimo R$ 10, todos os dias (9h-17h).
- **Pontuação:**
  - Proporção: **R$ 50,00 = 5 Pontos Arena**.
- **Bônus de Cadastro:**
  - Voucher de **R$ 30,00** no cadastro (plano de R$ 50 sai por R$ 20).

## Detalhes Técnicos
- Atualizar migrações SQL para refletir as novas taxas e níveis de comissão.
- Modificar `src/lib/app.functions.ts` e `confirm_payment` no banco para processar 8 níveis.
- Atualizar componentes de UI para refletir a nova marca e regras.
