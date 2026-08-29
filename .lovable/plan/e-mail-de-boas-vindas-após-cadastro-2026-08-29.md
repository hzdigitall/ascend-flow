# E-mail de boas-vindas após cadastro

## Objetivo
Enviar automaticamente um e-mail de boas-vindas para o endereço usado no cadastro (Gmail ou qualquer provedor), logo após a conta ser criada com sucesso.

## O que será feito

1. **Novo template `welcome`** em `src/lib/email-templates/welcome.tsx`
   - Identidade Arena: primária #FB096E, secundária #9F0B35, fundo branco (padrão de e-mail), logo da coroa.
   - Conteúdo: saudação com o nome do usuário, destaque para o bônus de cadastro de R$ 30, botão "Acessar minha conta" apontando para o site oficial e links de suporte (WhatsApp e grupo oficial).
   - Fallback: se o nome não estiver disponível, usa "Olá!".

2. **Registro do template** em `src/lib/email-templates/registry.ts` (chave `welcome`).

3. **Gatilho de envio** dentro da função server-side já existente `notifyMySignup` (`src/lib/whatsapp.functions.ts`), que hoje já roda logo após o cadastro:
   - Reaproveita as proteções atuais: só executa para contas criadas há menos de 15 minutos e grava trilha em `admin_logs`, garantindo que o e-mail seja enviado **uma única vez** por usuário (sem duplicidade em re-tentativas).
   - Busca nome/e-mail do perfil e chama `sendTemplateEmail('welcome', email, ...)`.
   - Falha no envio nunca bloqueia o cadastro (capturada e ignorada no fluxo).

## Detalhes técnicos
- Nenhuma rota ou tela nova; a chamada já existente em `cadastro.tsx` (após `signUp`) passa a cobrir também o e-mail.
- Envio via infraestrutura de e-mail já configurada no domínio `notify.arenasuplementos.com` — ativa em produção; em preview o envio real não ocorre.
- O rodapé de descadastro é adicionado automaticamente pela plataforma (obrigatório).

## Validação
- Build/typecheck e prévia do template no painel Cloud → Emails.
- Teste de cadastro em ambiente de preview para confirmar que o fluxo não quebra.
