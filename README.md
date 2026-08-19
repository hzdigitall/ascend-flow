# Ascend Flow

Quero que você desenvolva um sistema web completo, moderno, responsivo e 100% funcional, inspirado na estrutura, organização e experiência visual dos screenshots que anexei nesta conversa.

IMPORTANTE:

- Os screenshots devem ser usados APENAS como referência visual e funcional.

- Não copie logotipo, identidade visual, textos proprietários ou elementos de marca da empresa dos screenshots.

- Crie uma identidade visual própria.

- O sistema deve funcionar de verdade, sem dados falsos ou botões meramente decorativos.

- Não crie funcionalidades simuladas. Tudo que aparecer na interface deve estar conectado ao backend/banco de dados.

- O projeto deve estar preparado para produção.

- Utilize Supabase para autenticação, banco de dados, storage e funções server-side.

- Estruture o projeto para permitir integração real com gateway de pagamento PIX.

- Todos os valores, regras, produtos, planos, comissões e configurações importantes devem ser administráveis pelo painel administrativo.

==================================================

1. TECNOLOGIA E ARQUITETURA

==================================================

Utilize:

- React

- TypeScript

- Vite

- Tailwind CSS

- shadcn/ui

- Supabase

- PostgreSQL

- Supabase Auth

- Supabase Storage

- Supabase Edge Functions quando necessário

- Lucide Icons

O sistema deve ser:

- Responsivo para desktop, tablet e celular

- Rápido

- SEO friendly na área pública

- Componentizado

- Seguro

- Com boa acessibilidade

- Com loading states

- Com skeleton loaders

- Com mensagens de sucesso/erro

- Com tratamento de erros

- Sem console errors

- Sem links quebrados

- Sem funcionalidades falsas

==================================================

2. IDENTIDADE VISUAL

==================================================

NÃO utilize o azul predominante dos screenshots.

Criar uma identidade moderna usando:

COR PRINCIPAL:

- Laranja vibrante: #FF6A00

COR SECUNDÁRIA:

- Roxo/morado: #6D28D9

OUTRAS CORES:

- Laranja claro: #FFF1E6

- Roxo claro: #F3E8FF

- Fundo principal: #FAFAFA

- Fundo escuro opcional: #171717

- Branco: #FFFFFF

- Texto principal: #171717

- Texto secundário: #737373

- Verde para status positivo: #16A34A

- Vermelho para erros: #DC2626

Utilizar gradientes modernos:

- Laranja → roxo

- Laranja → laranja escuro

- Roxo → roxo escuro

A interface deve ter aparência de uma plataforma profissional SaaS/fintech moderna.

Evitar excesso de sombras.

Utilizar:

- bordas arredondadas

- cards limpos

- tipografia moderna

- ícones Lucide

- bastante espaçamento

- hierarquia visual clara

Criar dark mode opcional, mas o padrão inicial deve ser light mode.

==================================================

3. ESTRUTURA PRINCIPAL

==================================================

Criar duas áreas:

ÁREA DO USUÁRIO:

/login

/cadastro

/recuperar-senha

/dashboard

/planos

/meus-planos

/movimentacoes

/saque

/indicacoes

/trocar-pontos

/pedidos

/conta

/notificacoes

ÁREA ADMINISTRATIVA:

/admin

/admin/dashboard

/admin/usuarios

/admin/planos

/admin/produtos

/admin/pedidos

/admin/pagamentos

/admin/saques

/admin/indicacoes

/admin/pontos

/admin/movimentacoes

/admin/configuracoes

/admin/banners

/admin/notificacoes

/admin/logs

Criar proteção de rotas baseada em autenticação e role.

Roles:

- user

- admin

Usuário comum nunca pode acessar páginas administrativas.

==================================================

4. LOGIN E CADASTRO

==================================================

Criar uma tela de login profissional.

Campos:

- E-mail

- Senha

Botões:

- Entrar

- Esqueci minha senha

- Criar minha conta

Cadastro:

- Nome completo

- E-mail

- Telefone

- CPF

- Senha

- Confirmar senha

- Código de indicação opcional

Checkbox:

"Li e concordo com os Termos de Uso e Política de Privacidade."

Validações:

- E-mail válido

- Senha forte

- CPF válido

- Telefone válido

- E-mail único

Utilizar Supabase Auth.

Após cadastro:

- criar usuário no auth

- criar registro na tabela profiles

- registrar quem indicou o usuário

- gerar código/link de indicação único

- direcionar para dashboard

Criar recuperação de senha funcional.

==================================================

5. DASHBOARD DO USUÁRIO

==================================================

Criar dashboard inspirado no layout dos screenshots.

Layout:

SIDEBAR ESQUERDA:

Logo da plataforma

Menu:

Início

Novo Plano

Meus Planos

Movimentações

Saque via PIX

Indicações

Trocar Pontos

Separador

Meus Pedidos

Conta

Suporte

No rodapé da sidebar:

Card:

"SEU PATROCINADOR"

Mostrar:

- nome

- avatar/iniciais

- botão WhatsApp, caso exista

HEADER:

Logo/menu

À direita:

- ícone de notificações

- nome do usuário

- e-mail

- avatar

- dropdown

Conteúdo:

Título:

"Bem-vindo, [Nome]"

Subtítulo:

"Gerencie seus planos, acompanhe seus pontos e atividades."

CARD DE VERIFICAÇÃO:

Caso o e-mail não esteja confirmado:

"Confirme seu e-mail"

"Enviamos um link para [email]"

Botão:

"Reenviar e-mail"

Esse card desaparece após confirmação.

==================================================

6. CARDS FINANCEIROS

==================================================

Criar cards:

Saldo Total

Rendimentos

Indicações

Pontos disponíveis

Cada card deve mostrar:

- valor

- ícone

- variação quando aplicável

- informação complementar

Exemplo:

SALDO TOTAL

R$ 0,00

RENDIMENTOS

R$ 0,00

INDICAÇÕES

R$ 0,00

PONTOS

0 pts

Adicionar opção de ocultar/exibir valores sensíveis.

==================================================

7. AÇÕES RÁPIDAS

==================================================

Criar dois botões grandes:

"Pagar"

"Sacar"

Pagar:

- direcionar para compra de plano.

Sacar:

- direcionar para fluxo de saque PIX.

==================================================

8. BANNER PRINCIPAL

==================================================

Criar área de banner promocional no dashboard.

O banner deve ser administrável pelo painel admin.

Campos:

- imagem

- título

- subtítulo

- botão

- URL

- ativo/inativo

- ordem

- data inicial

- data final

Permitir vários banners e carousel.

Não inserir imagens externas aleatórias.

Utilizar Supabase Storage para upload.

==================================================

9. INDICAÇÃO / INDIQUE E GANHE

==================================================

Criar card:

"Indique e Ganhe"

Texto:

"Compartilhe seu link e acompanhe suas indicações."

Mostrar:

"Seu link de convite"

Exemplo:

https://seudominio.com/cadastro?ref=ABC123

Botões:

"Copiar link"

"Compartilhar"

O botão compartilhar deve utilizar Web Share API quando disponível.

Criar botão específico:

"Compartilhar no WhatsApp"

Gerar mensagem automaticamente.

Exemplo:

"Conheça nossa plataforma e faça seu cadastro através do meu link:

[LINK]"

==================================================

10. SISTEMA DE INDICAÇÃO

==================================================

Cada usuário terá:

- referral_code

- referral_link

- patrocinador

- quantidade de indicados

- saldo de comissão

Quando alguém se cadastrar através do link:

- registrar o patrocinador

- criar relação entre usuário e patrocinador

Criar níveis configuráveis no admin.

Exemplo:

Nível 1:

X%

Nível 2:

X%

Nível 3:

X%

IMPORTANTE:

As porcentagens não devem estar hardcoded.

O administrador poderá alterar essas configurações.

Registrar todas as comissões no banco.

Nunca permitir comissão duplicada para a mesma transação.

==================================================

11. PÁGINA NOVO PLANO

==================================================

Criar página:

"Escolha o plano ideal para você"

Subtítulo:

"Escolha uma opção e acompanhe seus benefícios."

Criar cards de planos.

Cada plano deve possuir:

- nome

- preço

- pontos

- descrição

- benefícios

- validade

- status

- imagem opcional

- ordem

- ativo/inativo

Exemplo visual:

INICIANTE

R$ 10,00

150 pontos

Benefícios:

✓ Pontos para troca

✓ Participação em campanhas

✓ Liberação após confirmação do pagamento

✓ Validade configurável

Botão:

"Pagar com PIX"

Criar outros planos.

IMPORTANTE:

Os exemplos acima são apenas dados iniciais. O administrador deverá conseguir criar, editar e remover planos.

==================================================

12. PAGAMENTO PIX

==================================================

Criar fluxo REAL de pagamento.

Ao clicar em:

"Pagar com PIX"

Abrir checkout:

Resumo da compra

Plano:

Nome do plano

Valor:

R$ XX,XX

Gerar pagamento PIX.

Mostrar:

- QR Code

- código copia e cola

- valor

- tempo de expiração

- status do pagamento

Status:

PENDENTE

PAGO

EXPIRADO

CANCELADO

O sistema deve atualizar automaticamente o status através de webhook do gateway.

NÃO considerar pagamento como aprovado apenas porque o usuário abriu a tela.

Somente liberar:

- plano

- pontos

- benefícios

depois da confirmação real do pagamento.

Criar estrutura preparada para gateway PIX.

As credenciais do gateway devem ficar exclusivamente em variáveis de ambiente/secrets.

Nunca colocar secret key no frontend.

==================================================

13. MEUS PLANOS

==================================================

Criar página:

"Meus Planos"

Mostrar cards/tabela:

Plano

Valor

Data da compra

Data de ativação

Validade

Pontos recebidos

Status

Status:

- Ativo

- Pendente

- Expirado

- Cancelado

Permitir visualizar detalhes.

==================================================

14. MOVIMENTAÇÕES

==================================================

Criar página de extrato.

Filtros:

- Todas

- Entradas

- Saídas

- Pagamentos

- Rendimentos

- Indicações

- Saques

- Pontos

Tabela:

Data

Descrição

Tipo

Valor

Status

Exemplo:

10/08/2026

Compra de plano

Saída

-R$ 30,00

Concluído

Criar paginação.

Criar busca.

==================================================

15. SAQUE VIA PIX

==================================================

Criar fluxo de saque.

Primeiro passo:

"De onde sairá o dinheiro?"

Opções:

Rendimentos

Indicações

Mostrar saldo disponível de cada carteira.

Depois:

"Informe os dados do PIX"

Tipos:

- CPF

- CNPJ

- E-mail

- Telefone

- Chave aleatória

Campos:

Tipo da chave

Chave PIX

Valor

Validar:

- saldo suficiente

- valor mínimo

- limite máximo

- chave preenchida

Mostrar resumo:

Valor do saque

Taxa

Valor líquido

Botão:

"Solicitar saque"

Status:

- Pendente

- Em análise

- Processando

- Pago

- Rejeitado

- Cancelado

O admin deverá conseguir aprovar/rejeitar saques.

Nunca permitir saldo negativo.

Utilizar transações no banco para evitar dupla retirada.

==================================================

16. CARTEIRAS

==================================================

Criar carteiras separadas:

wallet_balance

earnings_balance

referral_balance

points_balance

Todas as movimentações devem gerar registros no ledger.

Nunca alterar saldo manualmente sem registrar uma movimentação.

Criar tabela:

wallet_transactions

Campos:

id

user_id

wallet_type

type

amount

balance_before

balance_after

description

reference_id

status

created_at

==================================================

17. SISTEMA DE PONTOS

==================================================

Criar sistema de pontos.

Usuário poderá ganhar pontos conforme regras configuradas.

Tipos:

- compra de plano

- bônus

- campanha

- indicação

- ajuste administrativo

Criar histórico:

Data

Descrição

Pontos

Tipo

Exemplo:

Compra do plano

+450 pts

==================================================

18. TROCAR PONTOS

==================================================

Criar página:

"Trocar Pontos"

Topo:

Pontos disponíveis

0 pts

Texto:

"Use seus pontos para resgatar produtos do catálogo."

Criar catálogo em grid.

Cada produto:

- imagem

- nome

- descrição

- pontos necessários

- estoque

- botão "Resgatar"

Exemplo:

COQUETELEIRA

8.550 pts

Botão:

"Resgatar"

Outro:

CREATINA MONOHIDRATADA

12.350 pts

Botão:

"Resgatar"

Mas todos esses valores devem ser configuráveis no admin.

==================================================

19. RESGATE DE PRODUTOS

==================================================

Ao clicar em resgatar:

Abrir modal:

Produto

Pontos necessários

Pontos disponíveis

Endereço de entrega:

Nome

CEP

Rua

Número

Complemento

Bairro

Cidade

Estado

Botão:

"Confirmar resgate"

Após confirmar:

- verificar pontos

- verificar estoque

- descontar pontos

- criar pedido

- diminuir estoque

- registrar movimentação

- gerar número do pedido

Tudo deve ocorrer de maneira atômica.

Nunca permitir resgate acima do saldo de pontos.

==================================================

20. MEUS PEDIDOS

==================================================

Criar página:

"Meus Pedidos"

Mostrar:

Número

Produto

Data

Pontos utilizados

Status

Status:

- Pedido realizado

- Em preparação

- Enviado

- Entregue

- Cancelado

Permitir visualizar detalhes.

Se enviado:

Mostrar código de rastreamento quando disponível.

==================================================

21. NOTIFICAÇÕES

==================================================

Criar sistema de notificações.

Eventos:

- pagamento aprovado

- pagamento pendente

- pagamento expirado

- plano ativado

- pontos recebidos

- saque solicitado

- saque aprovado

- saque rejeitado

- pedido atualizado

- nova indicação

Header com sino.

Mostrar contador de notificações não lidas.

Permitir:

"Marcar todas como lidas."

==================================================

22. CONTA

==================================================

Criar página de configurações.

Seções:

Perfil

- Nome

- E-mail

- Telefone

- CPF

Segurança

- Alterar senha

- Sessões

Dados PIX

- Chave PIX

- Tipo

Preferências

- Receber notificações

- E-mail

- WhatsApp

Também criar opção de sair.

==================================================

23. PAINEL ADMINISTRATIVO

==================================================

Criar painel administrativo completamente separado.

Dashboard admin:

Cards:

Usuários cadastrados

Usuários ativos

Planos vendidos

Volume de pagamentos

Saques pendentes

Pedidos pendentes

Comissões geradas

Pontos emitidos

Gráficos:

- novos usuários por período

- vendas por período

- pagamentos

- saques

- indicações

- resgates

Filtros:

Hoje

7 dias

30 dias

90 dias

Personalizado

==================================================

24. ADMIN - USUÁRIOS

==================================================

Tabela:

Nome

E-mail

Telefone

Plano

Saldo

Pontos

Patrocinador

Status

Cadastro

Ações:

Visualizar

Editar

Bloquear

Desbloquear

Resetar senha

Ver movimentações

Ver indicações

Permitir pesquisa.

==================================================

25. ADMIN - PLANOS

==================================================

CRUD completo.

Criar:

Novo Plano

Campos:

Nome

Preço

Pontos

Descrição

Benefícios

Validade

Imagem

Status

Ordem

Ações:

Criar

Editar

Duplicar

Ativar

Desativar

Excluir

Não permitir exclusão de plano que possua transações históricas; nesse caso, apenas desativar.

==================================================

26. ADMIN - PRODUTOS

==================================================

CRUD completo.

Campos:

Nome

Descrição

Imagem

Pontos necessários

Estoque

SKU

Peso

Status

Categoria

Ações:

Criar

Editar

Excluir

Alterar estoque

Ativar/desativar

==================================================

27. ADMIN - PAGAMENTOS

==================================================

Mostrar todos os pagamentos.

Filtros:

Pendente

Pago

Expirado

Cancelado

Dados:

ID

Usuário

Plano

Valor

Gateway

ID externo

Data

Status

Não permitir alterar pagamento para "pago" manualmente sem registrar auditoria.

==================================================

28. ADMIN - SAQUES

==================================================

Mostrar:

Usuário

Carteira

Valor

Taxa

Valor líquido

Chave PIX

Data

Status

Ações:

Aprovar

Rejeitar

Marcar como pago

Ao rejeitar:

Solicitar motivo.

Ao aprovar/pagar:

registrar movimentação financeira.

==================================================

29. ADMIN - INDICAÇÕES

==================================================

Mostrar árvore de indicação.

Exemplo:

Usuário A

 ├── Usuário B

 │    ├── Usuário D

 │    └── Usuário E

 └── Usuário C

Mostrar:

- indicados

- comissões

- nível

- data

- status

==================================================

30. ADMIN - CONFIGURAÇÕES

==================================================

Criar configurações editáveis:

Nome da plataforma

Logo

Favicon

E-mail de suporte

WhatsApp

Valor mínimo de saque

Valor máximo de saque

Taxa de saque

Prazo de saque

Pontos por plano

Regras de indicação

Comissões

Configuração PIX

Termos de uso

Política de privacidade

Mensagem de manutenção

As configurações sensíveis devem ficar protegidas.

==================================================

31. ADMIN - BANNERS

==================================================

Criar gerenciador de banners.

Campos:

Imagem

Título

Descrição

Botão

URL

Ordem

Ativo

Data inicial

Data final

Upload via Supabase Storage.

==================================================

32. SEGURANÇA

==================================================

Implementar obrigatoriamente:

- Row Level Security (RLS) no Supabase

- Usuário só acessa seus próprios dados

- Admin possui permissões específicas

- Nunca confiar em valores enviados pelo frontend

- Validar valores no backend

- Validar saldo no backend

- Validar pontos no backend

- Evitar race conditions

- Evitar duplicação de pagamentos

- Evitar duplicação de comissões

- Evitar duplicação de resgates

- Webhooks autenticados

- Secrets somente no backend

- Logs de ações administrativas

- Rate limiting quando aplicável

==================================================

33. BANCO DE DADOS

==================================================

Criar tabelas adequadas, incluindo:

profiles

roles

plans

user_plans

payments

payment_events

wallets

wallet_transactions

referrals

commissions

points_wallets

points_transactions

products

product_categories

orders

order_items

withdrawals

pix_keys

notifications

banners

settings

admin_logs

Criar:

- foreign keys

- indexes

- constraints

- timestamps

- created_at

- updated_at

Usar UUID como IDs.

==================================================

34. REGRAS IMPORTANTES

==================================================

Não colocar regras financeiras diretamente no frontend.

Toda regra importante deve ser validada no backend.

Exemplo:

Se usuário possui:

100 pontos

e produto custa:

150 pontos

o backend deve rejeitar o resgate.

Mesmo que o frontend envie uma requisição manipulada.

Da mesma forma para:

- saques

- pagamentos

- comissões

- pontos

- planos

==================================================

35. ESTADOS DE INTERFACE

==================================================

Todas as páginas devem ter:

Loading

Empty state

Error state

Success state

Exemplo de empty state:

"Você ainda não possui planos."

Botão:

"Conhecer planos"

==================================================

36. RESPONSIVIDADE

==================================================

Desktop:

Sidebar fixa.

Mobile:

Sidebar vira menu drawer.

Header responsivo.

Cards adaptáveis.

Tabelas devem possuir scroll horizontal ou versão mobile em cards.

Nunca deixar conteúdo quebrado em celular.

==================================================

37. EXPERIÊNCIA VISUAL

==================================================

O layout deve seguir uma estrutura semelhante aos screenshots:

Sidebar esquerda

Header superior

Conteúdo central

Cards

Seções organizadas

Porém criar uma aparência mais moderna.

Usar:

- laranja

- roxo

- branco

- cinza claro

Botões principais em laranja.

Botões secundários podem utilizar roxo.

Status positivos em verde.

Evitar poluição visual.

==================================================

38. LOGO

==================================================

Criar inicialmente um placeholder de logo com o nome:

[NOME DA PLATAFORMA]

Deixar o logo configurável pelo painel administrativo.

Permitir upload da logo.

==================================================

39. DADOS DEMONSTRATIVOS

==================================================

Criar seed inicial somente para demonstração.

Exemplos:

3 planos

6 produtos

algumas categorias

Mas deixar claramente configurado como dados iniciais.

O sistema real deve buscar tudo do banco.

Não deixar valores importantes hardcoded.

==================================================

40. AUDITORIA

==================================================

Criar sistema de logs administrativos.

Registrar:

- quem executou

- ação

- tabela

- registro afetado

- valor anterior

- valor novo

- IP quando disponível

- data/hora

Exemplos:

ADMIN aprovou saque

ADMIN alterou plano

ADMIN alterou pontos

ADMIN alterou comissão

==================================================

41. TERMOS E CONFORMIDADE

==================================================

Criar páginas:

/termos

/privacidade

/politica-cookies

Deixar os textos editáveis pelo administrador.

IMPORTANTE:

Não apresentar automaticamente qualquer plano como investimento garantido.

Não utilizar frases como:

"lucro garantido"

"renda garantida"

"retorno garantido"

Qualquer regra de remuneração/benefício deve ser configurável e apresentada de forma transparente.

==================================================

42. SUPORTE

==================================================

Criar botão de suporte no sistema.

Possibilitar configuração pelo admin:

WhatsApp

E-mail

Link externo

Criar botão:

"Falar com suporte"

==================================================

43. BANCO E FLUXOS

==================================================

Antes de finalizar, faça uma revisão completa dos relacionamentos do banco.

Fluxo de compra:

Usuário

↓

Escolhe plano

↓

Cria pagamento

↓

PIX

↓

Gateway

↓

Webhook

↓

Pagamento confirmado

↓

Plano ativado

↓

Pontos creditados

↓

Comissão calculada

↓

Ledger atualizado

↓

Notificação enviada

Fluxo de saque:

Usuário

↓

Escolhe carteira

↓

Informa PIX

↓

Informa valor

↓

Backend valida saldo

↓

Cria saque pendente

↓

Reserva/desconta saldo de forma segura

↓

Admin processa

↓

Saque pago ou rejeitado

↓

Ledger atualizado

↓

Notificação

Fluxo de pontos:

Compra/resgate/bonificação

↓

Backend valida regra

↓

Crédito de pontos

↓

Registro no points_transactions

Fluxo de resgate:

Usuário

↓

Escolhe produto

↓

Backend verifica pontos

↓

Backend verifica estoque

↓

Debita pontos

↓

Cria pedido

↓

Atualiza estoque

↓

Notifica usuário

==================================================

44. NÃO ENTREGAR APENAS FRONTEND

==================================================

IMPORTANTE:

Não quero apenas uma interface visual.

Quero:

Frontend

+

Supabase

+

Banco PostgreSQL

+

Autenticação

+

RLS

+

Backend

+

Edge Functions quando necessário

+

Webhooks

+

CRUD

+

Validações

+

Painel administrativo

+

Fluxos funcionais

Não deixar:

TODO

Coming Soon

Fake API

Mock API

Botões sem ação

Dados hardcoded onde deveria existir banco

Funções vazias

==================================================

45. CHECKLIST FINAL

==================================================

Antes de considerar o projeto concluído, faça uma auditoria:

[ ] Cadastro funciona

[ ] Login funciona

[ ] Logout funciona

[ ] Recuperação de senha funciona

[ ] Confirmação de e-mail funciona

[ ] Dashboard funciona

[ ] Planos carregam do banco

[ ] Compra funciona

[ ] PIX está preparado para gateway real

[ ] Webhook está preparado

[ ] Pagamento não é aprovado pelo frontend

[ ] Pontos são creditados corretamente

[ ] Indicações funcionam

[ ] Comissões funcionam

[ ] Saques funcionam

[ ] Saldo é validado no backend

[ ] Produtos carregam do banco

[ ] Resgate funciona

[ ] Estoque é atualizado

[ ] Pedidos funcionam

[ ] Notificações funcionam

[ ] Perfil funciona

[ ] Admin funciona

[ ] CRUD de planos funciona

[ ] CRUD de produtos funciona

[ ] CRUD de usuários funciona

[ ] Admin consegue processar saques

[ ] Banners funcionam

[ ] Configurações funcionam

[ ] RLS configurado

[ ] Usuário não consegue acessar dados de outro usuário

[ ] Admin possui permissões corretas

[ ] Responsividade funcionando

[ ] Mobile funcionando

[ ] Sem erros no console

[ ] Sem links quebrados

[ ] Sem funcionalidades falsas

==================================================

46. RESULTADO ESPERADO

==================================================

Quero uma plataforma com aparência profissional, semelhante em organização aos screenshots enviados, porém com identidade visual própria em LARANJA + ROXO.

A experiência deve parecer uma plataforma SaaS moderna e profissional.

Prioridades:

1. FUNCIONALIDADE REAL

2. SEGURANÇA

3. BANCO DE DADOS CORRETO

4. PAINEL ADMINISTRATIVO

5. EXPERIÊNCIA DO USUÁRIO

6. DESIGN RESPONSIVO

Comece primeiro criando a arquitetura do projeto, banco de dados, autenticação e RLS.

Depois implemente o dashboard e fluxos principais.

Depois implemente o painel administrativo.

Por último faça uma auditoria completa de todas as funcionalidades e corrija qualquer erro encontrado.

Não simplifique os fluxos.

Não substitua funcionalidades reais por mockups.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35b87076-8266-43d0-9bc0-100b94a9dab0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
