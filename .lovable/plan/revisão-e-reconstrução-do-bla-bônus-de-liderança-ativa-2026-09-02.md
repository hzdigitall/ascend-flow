# Revisão e reconstrução do BLA — Bônus de Liderança Ativa

Objetivo: deixar o BLA funcionando exatamente como descrito no texto oficial da Arena, com a tabela de graduações corrigida e administrável.

## Situação atual (verificada)

- Pontos válidos entram automaticamente: pontos do próprio plano + pontos de indicação (níveis 1, 2 e 3), sempre no mês corrente.
- A pontuação já é por mês (zera na virada) e a graduação conquistada já é permanente.
- A apuração roda todo dia 1º às 03h e paga o bônus na carteira de bônus/indicações, com notificação.
- Ainda não há nenhum registro de pontuação nem pagamento (nenhum pagamento confirmado desde a criação da estrutura).
- A tabela de graduações hoje está travada no banco: não dá para o admin corrigir pontos, valores ou requisitos pela tela.

## O que muda

### 1. Tabela de graduações administrável
- Nova seção "Graduações" dentro de `/admin/bla`: listar, criar, editar e ativar/desativar cada graduação (nome, nível, pontos exigidos, valor do BLA, requisito de equipe: quantos diretos e em qual graduação mínima).
- Assim você mesmo corrige os valores oficiais sem depender de nova alteração de código.

> Importante: para eu já deixar os valores certos, preciso que você me passe a tabela oficial (graduação, pontos, valor do BLA e requisito de equipe). Sem isso, mantenho os valores atuais e você ajusta pela nova tela.

### 2. Regras de qualificação alinhadas ao texto
- A cada mês o líder recebe o BLA da maior graduação cujos requisitos ele cumpriu **naquele mês** (pontos do mês + requisito de equipe).
- Não é preciso subir de graduação: repetir os requisitos da graduação atual mantém o pagamento.
- Se não se qualificar, mantém o título e fica registrado como "não qualificado" naquele mês, sem pagamento.
- Correção de regra: hoje quem não pontua nada no mês não gera registro nenhum. Passarão a ser considerados também os líderes já graduados com 0 pontos, para que o histórico mostre "não qualificado" em vez de um mês em branco.

### 3. Reprocessamento seguro
- Botão de reapuração no admin que permite reprocessar um período já apurado sem pagar duas vezes (paga só quem ainda não recebeu e atualiza quem mudou de status).

### 4. Tela do usuário (aba Plano de Carreira)
- Reescrita do bloco do BLA seguindo o texto oficial: pontos do mês, quanto falta para a próxima qualificação, graduação permanente, valor previsto no mês, contagem regressiva para a virada e histórico mês a mês (pago / não qualificado).
- Bloco "Como funciona" com o resumo das regras do texto oficial.

## Detalhes técnicos

- Banco: políticas de escrita em `career_ranks` para admin (hoje só leitura), ajuste em `process_monthly_bla` para incluir líderes graduados sem pontos e permitir reapuração idempotente; `qualified_rank_level` mantido como fonte da qualificação.
- Front: CRUD de graduações em `src/routes/_authenticated/admin/bla.tsx`; reescrita da aba carreira em `src/routes/_authenticated/indicacoes.tsx` usando `get_my_bla`, `career_ranks` e `bla_payouts`.
- Cron mensal `process-monthly-bla` (dia 1º, 03h) mantido.

## Verificação

- Simular pontuação de um usuário de teste, rodar a apuração do período e conferir: pagamento na carteira de bônus, notificação, histórico na aba do usuário e status "não qualificado" para quem ficou abaixo dos pontos.
