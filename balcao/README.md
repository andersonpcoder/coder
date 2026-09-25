# Balcão

SaaS de gestão de atendimento e agendamento para pequenos negócios que atendem
por horário: clínicas, consultórios odontológicos, barbearias, salões, estúdios
e prestadores de serviço. Tudo em português do Brasil.

Stack: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 +
componentes no padrão shadcn/ui (Radix) + Supabase (Postgres com RLS, Auth,
Storage, Realtime e Edge Functions em Deno).

## Módulos

| Módulo | O que tem |
|---|---|
| Página inicial (`/`) | Apresentação, recursos, planos e teste grátis |
| Login e cadastro | E-mail e senha, Google, recuperação de senha, termos LGPD |
| Onboarding (3 passos) | Empresa (link público, endereço, cor, logo, fuso), horário e serviços sugeridos por segmento, equipe |
| Painel | Atendimentos do dia, espera, tempo médio, comparecimento, faturamento, gráficos, equipe agora, próximos horários |
| Agenda | Dia, semana, mês e visão por profissional; arrastar, redimensionar, bloqueios, recorrência, filtros, sem conflitos |
| Fila | Check-in, encaixes, espera ao vivo, chamar próximo, painel de TV (`/tv`) |
| Atendimentos | WhatsApp, Instagram e chat do site numa caixa só; respostas rápidas com variáveis, transferir, resolver, agendar pela conversa |
| Clientes | Cadastro, ficha com histórico, busca, etiquetas, importar e exportar CSV, exportar e excluir dados (LGPD) |
| Equipe | Profissionais, serviços, horários, comissão, unidade, convite de acesso |
| Serviços | Nome, duração, preço, cor, categoria, profissionais habilitados |
| Financeiro | Recebimentos por período e forma (Pix, dinheiro, cartão), pendentes, recebimento avulso, comissões, CSV |
| Relatórios | Por período, profissional e serviço; faltas, horários de pico, canais, novos x recorrentes; CSV e PDF |
| Página pública (`/nome-da-empresa`) | Serviço, profissional (ou sem preferência), dia, horário, dados e confirmação; chat "Fale conosco" |
| Gestão do agendamento (`/agendamento/<token>`) | Cliente confirma, remarca ou cancela pelo link dos lembretes |
| Configurações | Empresa, unidades, usuários e convites, mensagens automáticas, respostas rápidas, integrações, API, plano e cobrança |
| Notificações | Lembretes 24h e 2h (WhatsApp e e-mail), aniversário, retorno após 30 dias, notificações internas |

### Permissões

| Papel | Acesso |
|---|---|
| Administrador | Tudo, inclusive financeiro completo, relatórios, plano e configurações |
| Recepção | Agenda, fila, atendimentos, clientes, equipe e serviços (leitura) e o caixa do dia |
| Profissional | Só a própria agenda e os próprios clientes; marca atendimentos como concluídos e bloqueia a própria agenda |

As regras valem no banco (RLS), não só na tela.

### Planos

| Plano | Preço padrão | Inclui |
|---|---|---|
| Básico | R$ 49,90 | 1 profissional, agenda, página pública, lembretes por e-mail |
| Profissional | R$ 99,90 | Até 5 profissionais, fila, WhatsApp, relatórios |
| Empresa | R$ 199,90 | Ilimitado, várias unidades, caixa de entrada unificada, API |

Teste grátis de 14 dias com tudo do plano Empresa. Os preços ficam em
`src/lib/plans.ts` e `supabase/functions/_shared/billing.ts` (mantenha iguais).
Os limites de profissionais e unidades também são validados no banco.

## Rodar localmente

```bash
cd balcao
npm install
npm run dev
```

Sem variáveis de ambiente o Balcão abre em **modo demonstração**: dados de
exemplo guardados no navegador, sem login. No menu do usuário dá para ver o
sistema como Administrador, Recepção ou Profissional. A página pública da
demonstração é `http://localhost:3000/estudio-aurora`.

Com o Supabase (local ou na nuvem), crie `balcao/.env.local` a partir de
`.env.example`. Mesmo com o Supabase configurado, o botão "Ver demonstração"
na tela de login continua disponível.

## Estrutura

```
balcao/
├── src/app/(app)/          telas com menu lateral (painel, agenda, fila, ...)
├── src/app/[slug]/         página pública de agendamento
├── src/app/agendamento/    gestão do agendamento pelo cliente
├── src/app/entrar, cadastrar, recuperar-senha, nova-senha, convite, onboarding
├── src/app/tv/             painel de TV da fila
├── src/middleware.ts       sessão do Supabase e proteção das rotas
├── src/components/         ui (primitivos), shell, agenda, clientes, equipe, config, public
├── src/lib/store.tsx       estado: demonstração ou Supabase (otimista + Realtime)
├── src/lib/db/             carga, gravação, mapeamento e Realtime do Supabase
├── src/lib/public-api.ts   página pública (funções public_* do banco)
└── supabase/
    ├── migrations/         schema, RLS, funções, planos, convites, API, chat
    ├── functions/          Edge Functions (Deno)
    ├── seed.sql            empresa de exemplo com 4 semanas de agenda
    ├── cron.sql            agendamentos do pg_cron
    └── config.toml         configuração do Supabase CLI
```

### Edge Functions

| Função | Para quê |
|---|---|
| `send-reminders` | Envia lembretes, aniversário e retorno pendentes (pg_cron a cada 5 min) |
| `send-message` | Entrega no WhatsApp ou Instagram a resposta escrita em Atendimentos |
| `meta-webhook` | Recebe mensagens do WhatsApp Cloud API e do Instagram |
| `whatsapp-webhook` | Recebe mensagens da Z-API ou da Evolution API |
| `billing-checkout` | Abre o pagamento da assinatura (Stripe, Asaas ou Mercado Pago) |
| `billing-webhook` | Atualiza a assinatura com as notificações do provedor |
| `billing-cancel` | Cancela a assinatura no provedor |
| `api` | API pública do plano Empresa (agendamentos, clientes, horários) |

Resposta "1", "sim" ou "confirmo" no WhatsApp confirma o agendamento das
próximas 48 horas.

## Publicar (Supabase + Vercel)

### 1. Supabase

1. Crie um projeto em https://supabase.com (região São Paulo, `sa-east-1`).
2. Aplique o banco com a CLI:
   ```bash
   npm install -g supabase
   supabase login
   cd balcao
   supabase link --project-ref SEU_PROJECT_REF
   supabase db push
   psql "$(supabase db url)" -f supabase/seed.sql   # opcional: empresa de exemplo
   ```
   As migrações também criam o bucket público `logos` no Storage.
3. **Authentication > URL Configuration:** Site URL `https://seudominio.com` e
   Redirect URLs `https://seudominio.com/**`.
4. **Authentication > Providers:** e-mail já vem ativo. Para o Google, crie as
   credenciais OAuth no Google Cloud (URI de redirecionamento
   `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`) e cole client ID e
   secret.
5. **Authentication > SMTP:** configure um SMTP próprio (Resend, SES,
   Brevo) para confirmação de e-mail e recuperação de senha em produção.

### 2. Edge Functions e segredos

```bash
supabase functions deploy send-reminders send-message meta-webhook whatsapp-webhook \
  billing-checkout billing-webhook billing-cancel api

supabase secrets set \
  PUBLIC_APP_URL=https://seudominio.com \
  CRON_SECRET=um-segredo-longo \
  RESEND_API_KEY=... EMAIL_FROM="Balcão <lembretes@seudominio.com>" \
  META_APP_SECRET=... \
  BILLING_PROVIDER=stripe
```

O `config.toml` já libera sem JWT as funções chamadas por terceiros
(webhooks, cron e API); elas validam a origem pelo próprio segredo.

Cobrança, conforme o provedor escolhido em `BILLING_PROVIDER`:

| Provedor | Segredos | Webhook |
|---|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PROFISSIONAL`, `STRIPE_PRICE_EMPRESA` | `.../functions/v1/billing-webhook?provider=stripe` (eventos `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`) |
| Asaas | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL` (sandbox: `https://api-sandbox.asaas.com/v3`) | `.../functions/v1/billing-webhook?provider=asaas` |
| Mercado Pago | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | `.../functions/v1/billing-webhook?provider=mercadopago` (tópicos de assinatura) |

Pix recorrente: o Asaas gera a cobrança Pix todo mês. Stripe e Mercado Pago
fazem assinatura só com cartão.

### 3. Agendamentos (pg_cron)

Habilite `pg_cron` e `pg_net` em **Database > Extensions**, troque
`SEU_PROJECT_REF` e `CRON_SECRET` em `supabase/cron.sql` e rode no SQL Editor.
Ele agenda o envio de mensagens a cada 5 minutos e a geração diária de
aniversários e retornos.

### 4. WhatsApp e Instagram

Cada empresa configura em **Configurações > Integrações**, que mostra a URL do
webhook e o token de verificação:

- **WhatsApp Cloud API (oficial):** app na Meta com o produto WhatsApp, número
  verificado e token permanente. Fora da janela de 24 horas a Meta só entrega
  mensagens com **modelo aprovado**: cadastre os lembretes como modelos e troque o
  envio em `_shared/messaging.ts` para `type: "template"`.
- **Z-API ou Evolution API:** conecte o número pelo QR Code e cole no provedor a
  URL de webhook mostrada no Balcão.
- **Instagram:** conta profissional ligada a uma página, com permissão
  `instagram_manage_messages`, e o mesmo webhook da Meta.

### 5. Vercel

1. Importe o repositório em https://vercel.com/new e defina **Root Directory**
   como `balcao`.
2. Variáveis de ambiente (veja `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
3. Faça o deploy e aponte o domínio em **Domains**. Os links públicos ficam em
   `https://seudominio.com/nome-da-empresa`.

## Como foi testado

- Migrações, seed e funções SQL num Postgres 16 com o GoTrue (Auth) e o
  PostgREST do Supabase rodando localmente.
- Testes de ponta a ponta no navegador (Playwright) contra esse ambiente:
  cadastro, onboarding, agenda com arrastar e soltar gravando no banco,
  clientes, importação CSV, exportar e excluir dados, página pública,
  confirmar, remarcar e cancelar pelo link, chat do site com resposta pela
  caixa de entrada, recuperação de senha com o e-mail real do GoTrue, convites
  de recepção e de profissional com as permissões de cada papel, limites de
  plano e o modo demonstração.
- Edge Functions rodando no Deno contra o mesmo ambiente: API pública,
  webhooks da Meta e da Z-API (cliente novo, mensagem duplicada, confirmação por
  "Sim"), `send-message`, `send-reminders`, geração de aniversários e o webhook de
  cobrança com eventos assinados do Stripe e do Asaas.

Não testado aqui, por depender de contas externas: envio real pelo WhatsApp,
Instagram e e-mail, checkout real no Stripe, Asaas e Mercado Pago, login com
Google, upload no Storage e o Realtime do Supabase (sem ele, os dados de outros
dispositivos aparecem ao recarregar a página). Faça esses testes no ambiente de homologação com as
contas sandbox de cada provedor antes de abrir para clientes.
