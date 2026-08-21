# Plano de Implementação: Visualização de Indicações por Nível

O objetivo é aprimorar a página de indicações para agrupar e exibir os indicados por cada um dos 8 níveis do sistema MLM da Arena Saúde, facilitando a visualização da rede pelo usuário.

## Alterações

### 1. Frontend: Ajuste na Página de Indicações
- **Arquivo:** `src/routes/_authenticated/indicacoes.tsx`
- **Lógica:** Agrupar os dados retornados pela query de `referrals` por nível (1 a 8).
- **Interface:** 
  - Utilizar o componente `Tabs` para separar os 8 níveis.
  - Exibir a contagem total de indicados em cada aba de nível.
  - Listar os nomes e datas de cadastro dos indicados dentro da aba correspondente.
  - Manter o link de indicação em destaque no topo.

### 2. Melhoria Visual
- Utilizar a paleta de cores Arena Saúde para destacar os níveis ativos.
- Adicionar ícones para representar a hierarquia da rede.

## Detalhes Técnicos
- A query no Supabase já retorna o campo `level`.
- O processamento de dados agrupará os indicados em um objeto indexado pelo nível para renderização eficiente.
