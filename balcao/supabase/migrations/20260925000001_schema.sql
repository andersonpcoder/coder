-- Balcão: estrutura principal do banco.
-- Todas as tabelas de negócio têm company_id e são isoladas por Row Level Security.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- Tipos -----------------------------------------------------------------------

create type member_role as enum ('admin', 'recepcao', 'profissional');
create type plan_tier as enum ('basico', 'profissional', 'empresa');
create type subscription_status as enum ('teste', 'ativa', 'inadimplente', 'cancelada');
create type appointment_status as enum (
  'agendado', 'confirmado', 'aguardando', 'em_atendimento', 'concluido', 'faltou', 'cancelado'
);
create type booking_channel as enum ('whatsapp', 'instagram', 'site', 'presencial', 'telefone');
create type time_block_kind as enum ('almoco', 'folga', 'feriado', 'outro');
create type queue_status as enum ('aguardando', 'chamado', 'em_atendimento', 'concluido', 'desistiu');
create type conversation_channel as enum ('whatsapp', 'instagram', 'site');
create type conversation_status as enum ('aberta', 'resolvida');
create type message_direction as enum ('entrada', 'saida', 'sistema');
create type payment_method as enum ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito');
create type notification_kind as enum (
  'lembrete_24h', 'lembrete_2h', 'confirmacao', 'aniversario', 'retorno', 'cancelamento'
);
create type notification_channel as enum ('whatsapp', 'email');
create type job_status as enum ('pendente', 'enviado', 'falhou', 'cancelado');

-- Empresas, unidades e usuários -----------------------------------------------

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  primary_color text not null default '#0F6E63',
  timezone text not null default 'America/Sao_Paulo',
  segment text,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  phone text,
  address_line text,
  city text,
  state text,
  postal_code text,
  -- {"1": [{"inicio": "09:00", "fim": "18:00"}], ...} com 0 = domingo.
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on units (company_id);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table memberships (
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index on memberships (user_id);

-- Equipe e serviços -------------------------------------------------------------

create table professionals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  unit_id uuid references units (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  role_title text,
  avatar_url text,
  commission_pct numeric(5, 2) not null default 0 check (commission_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on professionals (company_id);

create table work_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  professional_id uuid not null references professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index on work_hours (professional_id, weekday);

create table services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  category text not null default 'Geral',
  duration_min integer not null check (duration_min between 5 and 720),
  price_cents integer not null default 0 check (price_cents >= 0),
  -- Chave da paleta suave usada na agenda (lavanda, ceu, menta, pessego, rosa, areia).
  color text not null default 'menta',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on services (company_id);

create table professional_services (
  professional_id uuid not null references professionals (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  primary key (professional_id, service_id)
);

-- Clientes (CRM) ---------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  tags text[] not null default '{}',
  lgpd_consent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on customers (company_id);
create unique index customers_company_phone_key on customers (company_id, phone) where phone is not null;

create table consent_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  source booking_channel not null
);

-- Agenda -------------------------------------------------------------------------

create table appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  unit_id uuid references units (id) on delete set null,
  professional_id uuid not null references professionals (id) on delete restrict,
  service_id uuid not null references services (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete cascade,
  -- Agrupa as ocorrências de uma série recorrente (semanal, quinzenal, mensal).
  recurrence_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'agendado',
  channel booking_channel not null default 'presencial',
  price_cents integer not null default 0,
  notes text,
  -- Token usado pelo cliente final para cancelar ou remarcar sem login.
  manage_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Impede dois agendamentos ativos do mesmo profissional no mesmo horário.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelado', 'faltou'))
);
create index on appointments (company_id, starts_at);
create index on appointments (professional_id, starts_at);
create index on appointments (customer_id);

create table time_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  -- Nulo bloqueia a unidade inteira (ex.: feriado).
  professional_id uuid references professionals (id) on delete cascade,
  kind time_block_kind not null,
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);
create index on time_blocks (company_id, starts_at);

-- Fila de atendimento ------------------------------------------------------------

create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  unit_id uuid references units (id) on delete set null,
  appointment_id uuid references appointments (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  customer_name text not null,
  service_id uuid references services (id) on delete set null,
  professional_id uuid references professionals (id) on delete set null,
  ticket text not null,
  is_walk_in boolean not null default false,
  status queue_status not null default 'aguardando',
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);
create index on queue_entries (company_id, checked_in_at);

-- Caixa de entrada unificada ------------------------------------------------------

create table conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  channel conversation_channel not null,
  external_id text,
  status conversation_status not null default 'aberta',
  assigned_to uuid references auth.users (id) on delete set null,
  tags text[] not null default '{}',
  unread_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, channel, external_id)
);
create index on conversations (company_id, status, last_message_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  conversation_id uuid not null references conversations (id) on delete cascade,
  direction message_direction not null,
  body text not null,
  sent_by uuid references auth.users (id) on delete set null,
  external_id text,
  created_at timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

create table quick_replies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  body text not null
);

-- Financeiro ------------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  professional_id uuid references professionals (id) on delete set null,
  method payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  commission_cents integer not null default 0,
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index on payments (company_id, paid_at);

-- Notificações ---------------------------------------------------------------------

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  kind notification_kind not null,
  channel notification_channel not null,
  body text not null,
  active boolean not null default true,
  unique (company_id, kind, channel)
);

create table notification_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  kind notification_kind not null,
  channel notification_channel not null,
  scheduled_for timestamptz not null,
  status job_status not null default 'pendente',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  -- Evita duplicar mensagens sem agendamento (aniversário, retorno).
  dedupe_key text unique,
  unique (appointment_id, kind, channel)
);
create index on notification_jobs (status, scheduled_for);

create table internal_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  -- Nulo notifica todos os membros da empresa.
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on internal_notifications (company_id, created_at desc);

-- Assinatura e integrações ------------------------------------------------------------

create table subscriptions (
  company_id uuid primary key references companies (id) on delete cascade,
  plan plan_tier not null default 'profissional',
  status subscription_status not null default 'teste',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  current_period_end timestamptz,
  provider text check (provider in ('stripe', 'asaas', 'mercadopago')),
  provider_customer_id text,
  provider_subscription_id text
);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  provider text not null check (provider in ('whatsapp_cloud', 'zapi', 'evolution', 'instagram')),
  -- Configuração visível para o admin (ids de telefone, instância, URL).
  settings jsonb not null default '{}'::jsonb,
  -- Token de acesso. Os clientes não conseguem ler esta coluna (ver RLS);
  -- só as Edge Functions, com a service role.
  secret text,
  active boolean not null default false,
  unique (company_id, provider)
);

-- updated_at automático
create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger appointments_touch before update on appointments
  for each row execute function touch_updated_at();
