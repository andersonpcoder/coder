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
| Básico | R$ 19,90 | 1 profissional, agenda, página pública, lembretes por e-mail |
| Profissional | R$ 39,90 | Até 5 profissionais, fila, WhatsApp, relatórios |
| Empresa | R$ 79,90 | Ilimitado, várias unidades, caixa de entrada unificada, API |

Plano anual com 2 meses grátis. Os valores aparecem como preço de lançamento,
com o preço cheio riscado. Teste grátis de 14 dias com tudo do plano Empresa;
depois dele, sem assinatura, a conta fica bloqueada até escolher um plano
(pagamento atrasado tem 7 dias de tolerância). Os preços ficam em
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
| `send-invite` | Envia por e-mail o convite de equipe |
| `api` | API pública do plano Empresa (agendamentos, clientes, horários) |

Resposta "1", "sim" ou "confirmo" no WhatsApp confirma o agendamento das
próximas 48 horas.

## Publicar

O passo a passo completo, com as contas a criar e os valores a copiar, está em
**[DEPLOY.md](DEPLOY.md)**. Resumo:

1. Crie o projeto no Supabase e preencha `supabase/.env.production`.
2. Rode `bash scripts/deploy-supabase.sh` (banco, funções, segredos e agendamentos).
3. Importe o repositório na Vercel com a pasta `balcao` e três variáveis.
4. Configure URLs de login, webhooks de cobrança e, por empresa, o WhatsApp.

## Testes

| Comando | O que cobre |
|---|---|
| `npm run lint` | Tipos (TypeScript) |
| `npm test` | Regras de agenda, conflitos, recorrência, CSV, planos, preços e mapeamento do banco |
| `npm run test:db` | Banco num Postgres real: isolamento entre empresas, papéis, limites de plano, página pública, chat, convites, LGPD, aniversário |
| `npm run test:e2e` | Navegador (modo demonstração): agenda, fila e TV, atendimentos, página pública, clientes, permissões, celular |
| `deno check supabase/functions/*/index.ts` | Tipos das Edge Functions |

O workflow `.github/workflows/balcao.yaml` roda tudo isso a cada mudança em `balcao/`.

Durante o desenvolvimento, o app também foi testado de ponta a ponta contra o
Auth e o banco do Supabase rodando localmente: cadastro, onboarding, login,
recuperação de senha com o e-mail gerado pelo Auth, convites, página pública,
chat do site e as Edge Functions (API, webhooks da Meta e da Z-API, lembretes e
eventos de cobrança assinados do Stripe e do Asaas).

Dependem de contas reais e devem ser conferidos no primeiro deploy (lista em
DEPLOY.md): envio pelo WhatsApp, Instagram e e-mail, checkout nos provedores de
cobrança, login com Google, envio de logo e o Realtime.
