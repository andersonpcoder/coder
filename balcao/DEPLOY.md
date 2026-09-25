# Como hospedar o Balcão

Guia do zero até o sistema no ar no seu domínio. Leva de 1 a 2 horas na
primeira vez. Siga na ordem: alguns passos usam valores copiados nos anteriores.

## 0. Contas que você vai precisar

| Serviço | Para quê | Obrigatório |
|---|---|---|
| [Supabase](https://supabase.com) | Banco de dados, login, arquivos e funções | Sim |
| [Vercel](https://vercel.com) | Hospedar o site (entre com o GitHub) | Sim |
| Domínio (ex.: [Registro.br](https://registro.br)) | Endereço próprio, como `balcao.app` | Sim, para produção |
| [Resend](https://resend.com) | E-mails: confirmação de conta, senha, lembretes, convites | Sim |
| [Asaas](https://www.asaas.com), [Stripe](https://stripe.com) ou [Mercado Pago](https://www.mercadopago.com.br/developers) | Cobrar as assinaturas | Para vender os planos |
| [Google Cloud](https://console.cloud.google.com) | Botão "Continuar com Google" | Opcional |
| [Meta for Developers](https://developers.facebook.com) ou Z-API/Evolution | WhatsApp e Instagram | Cada empresa cliente configura o seu |

Recomendação: use o **Asaas** se quiser assinatura com **Pix**. Stripe e
Mercado Pago cobram assinatura só no cartão.

O plano gratuito do Supabase pausa o projeto após alguns dias sem uso. Para
clientes reais, use o plano pago (Pro), que também faz backup diário.

## 1. Supabase

1. Em https://supabase.com/dashboard, clique em **New project**.
   - Região: **South America (São Paulo)**.
   - Crie uma senha forte para o banco e guarde.
2. Quando o projeto terminar de criar, anote:
   - **Reference ID:** Project Settings > General.
   - **Connection string:** botão **Connect** no topo > aba **Connection string** >
     tipo **URI**, modo **Session pooler**. Troque `[YOUR-PASSWORD]` pela senha do passo 1.
   - **anon public key** e **Project URL:** Project Settings > API.
3. Em **Database > Extensions**, ative **pg_cron** e **pg_net**.

## 2. E-mail (Resend)

1. Crie a conta em https://resend.com e, em **Domains**, adicione seu domínio.
   Copie os registros DNS que o Resend mostra para o painel do seu domínio e
   espere a verificação ficar verde.
2. Em **API Keys**, crie uma chave e anote.
3. No Supabase, em **Authentication > Emails > SMTP Settings**, ative o SMTP
   próprio:
   - Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a chave do Resend.
   - Remetente: `nao-responda@seudominio.com`, nome `Balcão`.

Sem isso, o Supabase envia poucos e-mails por hora e os clientes não recebem a
confirmação de cadastro nem a recuperação de senha.

## 3. Cobrança

### Asaas (Pix e cartão)

1. Crie a conta. Para testar antes, use o sandbox em https://sandbox.asaas.com.
2. **Integrações > Chave de API:** gere e anote a chave.
3. Invente um token longo para o webhook (ex.: 32 letras e números) e anote.
   O webhook é cadastrado no passo 7.

### Stripe (cartão)

1. Em **Product catalog**, crie os produtos Básico, Profissional e Empresa, cada
   um com um preço **mensal recorrente** em BRL. Anote os três `price_...`.
2. **Developers > API keys:** anote a Secret key.
3. O segredo do webhook (`whsec_...`) aparece ao criar o webhook no passo 7.

### Mercado Pago (cartão)

1. Em **Suas integrações**, crie uma aplicação e anote o **Access Token** de produção.
2. O segredo do webhook aparece ao configurar as notificações no passo 7.

Os preços padrão são R$ 49,90, R$ 99,90 e R$ 199,90. Para mudar, edite
`src/lib/plans.ts` e `supabase/functions/_shared/billing.ts` (os testes avisam
se ficarem diferentes). No Stripe, os preços valem os cadastrados lá.

## 4. Publicar o banco e as funções

No seu computador (Windows com WSL, macOS ou Linux):

1. Instale o [Node.js 22](https://nodejs.org), a CLI do Supabase e o `psql`:
   ```bash
   npm install -g supabase
   # macOS: brew install libpq && brew link --force libpq
   # Ubuntu/WSL: sudo apt install postgresql-client
   supabase login
   ```
2. Baixe o projeto e entre na pasta:
   ```bash
   git clone https://github.com/andersonpcoder/coder.git
   cd coder/balcao
   ```
3. Crie o arquivo de configuração e preencha com os valores anotados:
   ```bash
   cp supabase/.env.production.example supabase/.env.production
   ```
   `CRON_SECRET`: invente 32 letras e números. `PUBLIC_APP_URL`: seu domínio
   com `https://` e sem barra no fim. Deixe em branco o que não for usar.
4. Confira e publique:
   ```bash
   bash scripts/deploy-supabase.sh --verificar
   bash scripts/deploy-supabase.sh
   ```
   Para ter uma empresa de exemplo com agenda preenchida, use
   `--com-exemplo` na primeira vez.

O script aplica o banco, publica as 9 funções, grava os segredos e agenda o
envio de mensagens a cada 5 minutos. No fim ele mostra os endereços usados
nos próximos passos.

## 5. Site na Vercel

1. Em https://vercel.com/new, importe o repositório `andersonpcoder/coder`.
2. Em **Root Directory**, escolha `balcao`. O framework (Next.js) é detectado sozinho.
3. Em **Environment Variables**, adicione:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU_REFERENCE_ID.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon public key |
   | `NEXT_PUBLIC_APP_URL` | `https://seudominio.com` |
4. Clique em **Deploy**.
5. Em **Settings > Domains**, adicione seu domínio e crie no painel do domínio
   os registros DNS que a Vercel indicar.

Depois disso, cada mudança enviada para a branch principal publica sozinha.

## 6. Login (Supabase > Authentication)

1. **URL Configuration:** Site URL `https://seudominio.com` e, em Redirect
   URLs, `https://seudominio.com/**`.
2. **Google (opcional):** no Google Cloud, crie uma credencial OAuth do tipo
   "Aplicativo da Web" com o URI de redirecionamento
   `https://SEU_REFERENCE_ID.supabase.co/auth/v1/callback`. Cole o Client ID e o
   Secret em **Providers > Google**.
3. **Emails (opcional):** traduza os textos dos e-mails de confirmação e de
   recuperação de senha.

Não rode `supabase config push`: o `config.toml` do projeto é para
desenvolvimento local e trocaria o Site URL de produção por `localhost`.

## 7. Webhook de cobrança

Cadastre no painel do provedor a URL que o script mostrou:

- **Asaas:** Integrações > Webhooks > URL
  `https://SEU_REFERENCE_ID.supabase.co/functions/v1/billing-webhook?provider=asaas`,
  token = `ASAAS_WEBHOOK_TOKEN`, eventos de cobrança e de assinatura.
- **Stripe:** Developers > Webhooks > endpoint `...?provider=stripe`, eventos
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET` e
  rode o script de novo.
- **Mercado Pago:** Suas integrações > Webhooks > URL `...?provider=mercadopago`,
  tópicos de **Planos e assinaturas**. Copie a assinatura secreta para
  `MP_WEBHOOK_SECRET` e rode o script de novo.

## 8. Primeiro acesso

1. Abra `https://seudominio.com`, clique em **Teste grátis** e crie sua conta.
2. Faça o onboarding. Sua empresa começa com 14 dias de teste do plano Empresa.
3. Se a empresa for sua (sem pagar assinatura), libere o plano no SQL Editor do Supabase:
   ```sql
   update subscriptions set plan = 'empresa', status = 'ativa', current_period_end = '2099-12-31'
   where company_id = (select id from companies where slug = 'seu-link');
   ```

## 9. WhatsApp e Instagram de cada empresa

Cada empresa cliente configura em **Configurações > Integrações**:

- **API oficial (Meta):** criar o app em developers.facebook.com com o produto
  WhatsApp, ligar o número, gerar um token permanente (usuário do sistema) e
  colar o ID do número e o token. Em **Webhooks**, usar a URL e o token de
  verificação mostrados no Balcão e assinar o campo `messages`.
  Para lembretes, crie na Meta modelos de mensagem (categoria "Utilidade") e,
  depois de aprovados, informe o nome e as variáveis em **Configurações >
  Mensagens**. Sem modelo, a Meta só entrega mensagens para quem escreveu nas
  últimas 24 horas.
- **Z-API ou Evolution:** conectar o número pelo QR Code no painel do provedor
  e colar lá a URL de webhook mostrada no Balcão.
- **Instagram:** conta profissional ligada a uma página do Facebook, com o app
  da Meta autorizado para mensagens; mesma URL de webhook da Meta.

## 10. Conferência depois do deploy

- [ ] Criar conta com e-mail e receber a confirmação.
- [ ] "Esqueci minha senha" chega e troca a senha.
- [ ] Login com Google (se ativou).
- [ ] Onboarding cria a empresa e abre o painel.
- [ ] Enviar o logo em Configurações > Empresa.
- [ ] Agendar pela página pública em outro celular e ver o horário aparecer na agenda.
- [ ] Abrir a agenda em dois aparelhos e ver a mudança de um aparecer no outro sem recarregar.
- [ ] Convidar alguém da recepção por e-mail.
- [ ] Assinar um plano no sandbox do provedor e ver o status mudar em Configurações > Plano.
- [ ] Criar um agendamento para daqui a 25 horas e, depois de 1 hora, ver o lembrete chegar.

Para ver se os lembretes estão saindo, rode no SQL Editor:
```sql
select kind, channel, status, attempts, last_error, scheduled_for
from notification_jobs order by scheduled_for desc limit 20;
```

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Depois de entrar, volta para a tela de login | Site URL ou Redirect URLs errados (passo 6) |
| E-mails não chegam | SMTP do Resend não configurado ou domínio não verificado (passo 2) |
| Lembretes ficam "pendente" | Extensões pg_cron/pg_net desativadas ou script não rodou até o fim |
| Lembrete com erro "WhatsApp não configurado" | A empresa ainda não ativou uma integração em Configurações |
| Assinatura paga, mas o plano não muda | Webhook de cobrança não cadastrado ou segredo diferente (passo 7) |
| Erro 401 no webhook | Token do webhook diferente do gravado em `supabase/.env.production` |

Logs: **Supabase > Edge Functions > (função) > Logs** e **Vercel > Deployments > Logs**.

## Atualizar depois

- Código do site: envie para a branch principal; a Vercel publica sozinha.
- Banco e funções: rode `bash scripts/deploy-supabase.sh` de novo. Ele só aplica
  as migrações novas.
