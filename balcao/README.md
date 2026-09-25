# Balcão

Gestão de atendimento e agendamento para pequenos negócios que atendem por
horário: clínicas, consultórios odontológicos, barbearias, salões, estúdios e
prestadores de serviço. Tudo em português do Brasil.

Stack: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 +
componentes no padrão shadcn/ui (Radix) + Supabase (Postgres, Auth, Storage,
Realtime, Edge Functions).

## Situação desta entrega (fase 1)

| Item                                                    | Situação                                                            |
|---------------------------------------------------------|---------------------------------------------------------------------|
| Estrutura do banco, RLS e funções                       | Pronto e testado num Postgres 16 local                              |
| Agenda (dia, semana, mês, equipe)                       | Pronta, com dados de exemplo                                        |
| Fila de atendimento e painel de TV                      | Pronta, com dados de exemplo                                        |
| Atendimentos (caixa de entrada unificada)               | Pronta, com dados de exemplo                                        |
| Painel (dashboard)                                      | Pronto, com dados de exemplo                                        |
| Clientes, Equipe, Serviços, Financeiro                  | Telas de consulta; cadastro e edição na próxima fase                |
| Relatórios, Configurações                               | Próxima fase                                                        |
| Lembretes automáticos                                   | Banco (fila de envios e gatilhos) e Edge Function prontos           |
| Autenticação, onboarding em 3 passos, página pública    | Funções no banco prontas (`create_company`, `public_*`); telas na próxima fase |
| Planos e cobrança recorrente                            | Tabela `subscriptions` pronta; integração na próxima fase           |

**Importante:** nesta fase as telas funcionam com dados de exemplo guardados no
navegador (`src/lib/store.tsx`), para dar para usar e avaliar sem configurar
nada. As ações (`src/lib/actions.ts`) aplicam as mesmas regras do banco
(conflito de horário, bloqueios, recorrência, status). A troca para o Supabase
substitui o `dispatch` de cada ação por uma chamada ao banco.

## Rodar localmente

```bash
cd balcao
npm install
npm run dev
```

Abra http://localhost:3000. No rodapé do menu, o seletor de usuário mostra o
Balcão como **Administrador**, **Recepção** ou **Profissional**, para testar
as permissões. "Restaurar dados de exemplo" volta ao estado inicial.

Para testar o painel de TV, abra a Fila e clique em **Painel de TV**: a janela
nova acompanha as chamadas em tempo real.

## O que cada tela faz

### Agenda
- Visões **Dia** (colunas por profissional), **Semana** (um profissional por
  vez), **Mês** e **Equipe** (linhas = profissionais, colunas = dias).
- Blocos coloridos por serviço, ponto de status e linha da hora atual.
- Clique num horário vazio para agendar; clique num bloco para editar.
- Arraste para mover (inclusive para outro profissional na visão Dia) e puxe a
  borda de baixo para mudar a duração. No celular, a edição é pelo formulário
  para não atrapalhar a rolagem.
- Conflitos com outro agendamento ou bloqueio são recusados com aviso.
- Recorrência semanal, quinzenal ou mensal; datas com conflito são puladas e
  informadas.
- Bloqueios de almoço, folga, feriado ou outro motivo, por profissional ou para
  toda a equipe.
- Filtros por profissional, serviço e status. "Concluir e receber" abre o
  registro de pagamento.

### Fila
- Check-in das chegadas previstas do dia (senha `A001`) e encaixes sem horário
  (senha `E001`).
- Tempo de espera ao vivo, com alerta de cor depois de 10 e 20 minutos.
- "Chamar próximo" (geral ou por profissional), iniciar, concluir com
  pagamento, desistência.
- Painel de TV (`/tv`) com senha, nome, profissional e últimas chamadas, com
  aviso sonoro.

### Atendimentos
- Abas Abertos, Meus e Resolvidos; busca e filtro por canal (WhatsApp,
  Instagram, site).
- Respostas rápidas: **Enviar horários disponíveis** (calcula os próximos
  horários livres do profissional), **Confirmar agendamento** (confirma o
  próximo horário do cliente) e **Endereço**.
- Transferir para outro atendente, resolver e reabrir.
- Painel do cliente: visitas, faltas, total gasto, observações, próximo
  agendamento, histórico e etiquetas.
- Botão **Agendar** abre a agenda já com o cliente e o canal da conversa.

## Estrutura

```
balcao/
├── src/app/(app)/        telas com menu lateral (painel, agenda, fila, ...)
├── src/app/tv/           painel de TV da fila, sem menu
├── src/components/       ui (primitivos), shell (menu), agenda, shared
├── src/lib/              tipos, formatação pt-BR, regras de agenda, estado
├── src/lib/supabase/     clientes do Supabase (navegador e servidor)
└── supabase/
    ├── migrations/       schema, RLS e funções
    ├── functions/        Edge Function send-reminders
    └── seed.sql          dados de exemplo
```

## Banco de dados

Todas as tabelas de negócio têm `company_id` e RLS habilitado.

| Grupo           | Tabelas                                                                         |
|-----------------|---------------------------------------------------------------------------------|
| Empresa         | `companies`, `units`, `memberships`, `profiles`, `subscriptions`, `integrations` |
| Equipe          | `professionals`, `work_hours`, `professional_services`                          |
| Serviços        | `service_categories`, `services`                                                |
| Clientes        | `customers`, `consent_logs`                                                     |
| Agenda          | `appointments`, `recurrences`, `time_blocks`                                    |
| Fila            | `queue_entries`                                                                 |
| Conversas       | `conversations`, `messages`, `quick_replies`                                    |
| Financeiro      | `payments`                                                                      |
| Notificações    | `message_templates`, `notification_jobs`, `internal_notifications`              |

Regras garantidas pelo banco:

- **Sem conflito de horário:** a restrição `appointments_no_overlap`
  (exclusão com `btree_gist`) impede dois agendamentos ativos do mesmo
  profissional no mesmo intervalo. Cancelados e faltas liberam o horário.
- **Permissões por papel** (`memberships.role`):
  - `admin`: tudo, inclusive financeiro completo, plano e integrações.
  - `recepcao`: agenda, fila, conversas e clientes; no financeiro, registra
    pagamentos e vê só o caixa do dia.
  - `profissional`: lê e atualiza só a própria agenda, vê só os próprios
    clientes e pagamentos.
- **Página pública sem login:** `public_company`, `public_available_slots`,
  `public_book` (exige consentimento LGPD e revalida o horário),
  `public_confirm` e `public_cancel` (pelo token do agendamento).
- **Onboarding:** `create_company` cria empresa, unidade principal, assinatura
  de teste de 14 dias, o usuário como admin, respostas rápidas e modelos de
  mensagem.
- **Lembretes:** cada agendamento gera envios 24h (WhatsApp e e-mail) e 2h
  (WhatsApp) antes; remarcar reagenda e cancelar suspende.
- **Notificações internas** para novo agendamento e cancelamento.
- **LGPD:** `export_customer_data` e `delete_customer_data` (apenas admin).
- **Tempo real:** `queue_entries`, `conversations`, `messages` e
  `appointments` publicadas no Supabase Realtime.

## Publicar (Supabase + Vercel)

### 1. Supabase

1. Crie um projeto em https://supabase.com (região São Paulo, `sa-east-1`).
2. Instale a CLI e vincule o projeto:
   ```bash
   npm install -g supabase
   supabase login
   cd balcao
   supabase link --project-ref SEU_PROJECT_REF
   ```
3. Aplique as migrações (e, se quiser, os dados de exemplo):
   ```bash
   supabase db push
   psql "$(supabase db url)" -f supabase/seed.sql   # opcional
   ```
4. Em **Authentication > Providers**, habilite e-mail/senha e Google
   (credenciais OAuth do Google Cloud). Em **URL Configuration**, cadastre a URL
   da Vercel como Site URL e `https://SEU-DOMINIO/**` em Redirect URLs, para a
   recuperação de senha funcionar.
5. Para ver os dados de exemplo com seu usuário, depois do primeiro login:
   ```sql
   insert into memberships (company_id, user_id, role)
   select '00000000-0000-0000-0000-00000000c001', id, 'admin'
   from auth.users where email = 'seu@email.com';
   ```

### 2. Lembretes automáticos

1. Publique a função e configure os segredos:
   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set CRON_SECRET=um-segredo-longo \
     WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
     RESEND_API_KEY=... EMAIL_FROM="Balcão <lembretes@seudominio.com>" \
     PUBLIC_APP_URL=https://seudominio.com
   ```
   O WhatsApp usa a Cloud API oficial da Meta. Fora da janela de 24h a Meta
   exige modelo de mensagem aprovado; cadastre o lembrete como modelo e troque
   o envio para `type: "template"`. Z-API e Evolution API podem substituir a
   função `sendWhatsApp`.
2. Agende a execução a cada 5 minutos (habilite `pg_cron` e `pg_net` em
   **Database > Extensions**):
   ```sql
   select cron.schedule('balcao-lembretes', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/send-reminders',
       headers := '{"Authorization": "Bearer um-segredo-longo"}'::jsonb
     );
   $$);
   ```

### 3. Vercel

1. Importe o repositório em https://vercel.com/new e defina **Root Directory**
   como `balcao`.
2. Variáveis de ambiente (veja `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_APP_URL`.
3. Faça o deploy. Para o link público por empresa (`balcao.app/nome-da-empresa`),
   aponte o domínio para o projeto na aba **Domains**.

## Próximas fases

1. Login (e-mail/senha e Google, recuperação de senha) e onboarding em 3
   passos, ligando as telas ao Supabase e ao Realtime.
2. Página pública de agendamento `/[empresa]` com confirmação, cancelamento e
   remarcação pelo token.
3. Cadastro e edição de clientes (importar CSV, LGPD), equipe e serviços.
4. Financeiro por período, relatórios com exportação em PDF e CSV.
5. Configurações, integrações (WhatsApp, Instagram) e cobrança recorrente
   (Stripe, Asaas ou Mercado Pago) com limites por plano.
