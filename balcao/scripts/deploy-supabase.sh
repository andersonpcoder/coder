#!/usr/bin/env bash
# Publica o banco, as Edge Functions, os segredos e os agendamentos do Balcão
# num projeto do Supabase.
#
# Uso:
#   cp supabase/.env.production.example supabase/.env.production   # e preencha
#   bash scripts/deploy-supabase.sh               # publica
#   bash scripts/deploy-supabase.sh --com-exemplo # também carrega a empresa de exemplo (só na 1ª vez)
#   bash scripts/deploy-supabase.sh --verificar   # só confere o arquivo e as ferramentas
#
# Requer: Supabase CLI (npm i -g supabase), psql e ter rodado "supabase login".
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="supabase/.env.production"
[[ -f "$ENV_FILE" ]] || { echo "Crie $ENV_FILE a partir de supabase/.env.production.example."; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

missing=()
for v in SUPABASE_PROJECT_REF SUPABASE_DB_URL PUBLIC_APP_URL CRON_SECRET; do
  [[ -n "${!v:-}" ]] || missing+=("$v")
done
if ((${#missing[@]})); then
  echo "Preencha em $ENV_FILE: ${missing[*]}"
  exit 1
fi
command -v supabase >/dev/null || { echo "Instale a Supabase CLI: npm i -g supabase"; exit 1; }
command -v psql >/dev/null || { echo "Instale o cliente do Postgres (psql)."; exit 1; }
[[ "$CRON_SECRET" =~ ^[A-Za-z0-9_-]{24,}$ ]] || { echo "CRON_SECRET: use 24+ letras, números, _ ou -."; exit 1; }
[[ "$PUBLIC_APP_URL" =~ ^https?://[^/]+$ ]] || { echo "PUBLIC_APP_URL: use só o endereço, sem barra no fim (ex.: https://balcao.app)."; exit 1; }
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -qAtc "select 1" >/dev/null || { echo "Não consegui conectar em SUPABASE_DB_URL."; exit 1; }

if [[ "${1:-}" == "--verificar" ]]; then
  echo "Tudo certo: arquivo preenchido, ferramentas instaladas e banco acessível."
  exit 0
fi

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

step "Aplicando as migrações do banco"
supabase db push --db-url "$SUPABASE_DB_URL"

if [[ "${1:-}" == "--com-exemplo" ]]; then
  step "Carregando a empresa de exemplo (Estúdio Aurora)"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
fi

step "Publicando as Edge Functions"
# Chamadas por terceiros (webhooks, agendador, API): validam a origem pelo próprio segredo.
for fn in meta-webhook whatsapp-webhook billing-webhook send-reminders api; do
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
done
# Chamadas pelo app com o usuário logado.
for fn in send-message send-invite billing-checkout billing-cancel; do
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"
done

step "Gravando os segredos das funções"
secrets=()
for v in PUBLIC_APP_URL CRON_SECRET RESEND_API_KEY EMAIL_FROM META_APP_SECRET BILLING_PROVIDER \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_BASICO STRIPE_PRICE_PROFISSIONAL STRIPE_PRICE_EMPRESA \
  ASAAS_API_KEY ASAAS_BASE_URL ASAAS_WEBHOOK_TOKEN MP_ACCESS_TOKEN MP_WEBHOOK_SECRET; do
  [[ -n "${!v:-}" ]] && secrets+=("$v=${!v}")
done
supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" "${secrets[@]}"

step "Agendando o envio de mensagens (pg_cron)"
sed -e "s/SEU_PROJECT_REF/$SUPABASE_PROJECT_REF/g" -e "s/CRON_SECRET/$CRON_SECRET/g" supabase/cron.sql |
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q

BASE="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1"
cat <<INFO

Pronto. Falta configurar, no painel de cada serviço:

  Supabase > Authentication > URL Configuration
    Site URL:       $PUBLIC_APP_URL
    Redirect URLs:  $PUBLIC_APP_URL/**

  Webhook de cobrança ($BILLING_PROVIDER):
    $BASE/billing-webhook?provider=${BILLING_PROVIDER:-asaas}

  Webhook da Meta (WhatsApp Cloud API / Instagram), por empresa:
    $BASE/meta-webhook   (token de verificação em Configurações > Integrações)

  Vercel (variáveis de ambiente):
    NEXT_PUBLIC_SUPABASE_URL=https://$SUPABASE_PROJECT_REF.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<Project Settings > API > anon public>
    NEXT_PUBLIC_APP_URL=$PUBLIC_APP_URL
INFO
