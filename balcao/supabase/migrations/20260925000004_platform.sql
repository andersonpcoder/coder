-- Balcão: convites, API, limites de plano, chat do site, gestão do agendamento
-- pelo cliente final, mensagens de aniversário e retorno, e armazenamento.

-- Integrações: o token (secret) nunca volta para o navegador.
revoke select on integrations from authenticated, anon;
grant select (id, company_id, provider, settings, active) on integrations to authenticated;

-- Perfil criado junto com o usuário do Auth ---------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_user_meta_data'
  ) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- Convites de equipe ----------------------------------------------------------------

create table invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  email text,
  role member_role not null,
  professional_id uuid references professionals (id) on delete set null,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
-- O profissional vinculado ao convite tem de ser da mesma empresa: aceitar o
-- convite liga a conta a ele.
create policy "admin gerencia convites" on invites for all
  using (is_admin(company_id))
  with check (
    is_admin(company_id)
    and (professional_id is null or exists (
      select 1 from professionals p where p.id = professional_id and p.company_id = invites.company_id
    ))
  );

create function public.public_invite(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('company', c.name, 'role', i.role, 'accepted', i.accepted_at is not null)
  from public.invites i join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado';
  end if;
  select * into v_invite from public.invites where token = p_token and accepted_at is null;
  if v_invite.id is null then
    raise exception 'Convite inválido ou já utilizado';
  end if;
  insert into public.memberships (company_id, user_id, role)
  values (v_invite.company_id, auth.uid(), v_invite.role)
  on conflict (company_id, user_id) do update set role = excluded.role;
  if v_invite.professional_id is not null then
    update public.professionals set user_id = auth.uid()
    where id = v_invite.professional_id and company_id = v_invite.company_id
      and (user_id is null or user_id = auth.uid());
    if not found then
      raise exception 'Este convite não é mais válido. Peça um novo ao administrador.';
    end if;
  end if;
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = v_invite.id;
  return v_invite.company_id;
end;
$$;

grant execute on function public.public_invite to anon, authenticated;

-- Chaves da API pública (plano Empresa) -----------------------------------------------

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  -- Só o hash SHA-256 é guardado; a chave aparece uma única vez ao ser criada.
  key_hash text not null unique,
  prefix text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table api_keys enable row level security;
create policy "admin gerencia chaves" on api_keys for all
  using (is_admin(company_id)) with check (is_admin(company_id));

-- Planos ------------------------------------------------------------------------------
-- Básico: 1 profissional. Profissional: até 5. Empresa: ilimitado e várias unidades.
-- Durante o teste grátis vale tudo do plano Empresa.

-- Conta ativa: teste em andamento, assinatura paga, pagamento atrasado há até
-- 7 dias ou cancelada dentro do período já pago. Sem isso a agenda fica bloqueada.
create function public.has_active_plan(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when s.status = 'teste' then s.trial_ends_at > now()
      when s.status = 'ativa' then true
      when s.status = 'inadimplente' then coalesce(s.current_period_end, now()) + interval '7 days' > now()
      when s.status = 'cancelada' then coalesce(s.current_period_end > now(), false)
    end
    from public.subscriptions s where s.company_id = p_company
  ), false);
$$;

create function public.effective_plan(p_company uuid) returns plan_tier
language sql stable security definer set search_path = '' as $$
  select case
    when s.status = 'teste' and s.trial_ends_at > now() then 'empresa'::public.plan_tier
    when public.has_active_plan(p_company) then s.plan
    else 'basico'::public.plan_tier
  end
  from public.subscriptions s where s.company_id = p_company;
$$;

create function public.enforce_active_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_active_plan(new.company_id) then
    raise exception 'Assinatura do Balcão inativa. Escolha um plano em Configurações > Plano e cobrança.';
  end if;
  return new;
end;
$$;
create trigger appointments_active_plan before insert on appointments
  for each row execute function public.enforce_active_plan();
create trigger queue_entries_active_plan before insert on queue_entries
  for each row execute function public.enforce_active_plan();

create function public.enforce_professional_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tier := public.effective_plan(new.company_id);
  v_limit integer := case v_plan when 'basico' then 1 when 'profissional' then 5 else null end;
begin
  if new.active and v_limit is not null and (
    select count(*) from public.professionals
    where company_id = new.company_id and active and id <> new.id
  ) >= v_limit then
    raise exception 'Seu plano permite até % profissional(is) ativo(s). Faça upgrade em Configurações > Plano.', v_limit;
  end if;
  return new;
end;
$$;
create trigger professionals_plan_limit before insert or update of active on professionals
  for each row execute function public.enforce_professional_limit();

create function public.enforce_unit_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.effective_plan(new.company_id) <> 'empresa'
    and exists (select 1 from public.units where company_id = new.company_id) then
    raise exception 'Várias unidades estão disponíveis no plano Empresa.';
  end if;
  return new;
end;
$$;
create trigger units_plan_limit before insert on units
  for each row execute function public.enforce_unit_limit();

-- Comissão calculada no registro do pagamento.
create function public.set_payment_commission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.professional_id is not null and new.commission_cents = 0 then
    select round(new.amount_cents * p.commission_pct / 100) into new.commission_cents
    from public.professionals p where p.id = new.professional_id;
  end if;
  return new;
end;
$$;
create trigger payments_commission before insert on payments
  for each row execute function public.set_payment_commission();

-- Mensagens: contadores da conversa e notificação interna -------------------------------

create function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.direction = 'entrada' then
    update public.conversations
    set unread_count = unread_count + 1, last_message_at = new.created_at, status = 'aberta'
    where id = new.conversation_id;
    select cu.name into v_name from public.conversations cv
    left join public.customers cu on cu.id = cv.customer_id where cv.id = new.conversation_id;
    insert into public.internal_notifications (company_id, kind, title, body, link)
    values (new.company_id, 'nova_mensagem', 'Nova mensagem',
      coalesce(v_name, 'Cliente') || ': ' || left(new.body, 80), '/atendimentos');
  else
    update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  end if;
  return new;
end;
$$;
create trigger messages_after_insert after insert on messages
  for each row execute function public.on_message_insert();

-- Chat do site (sem login): o visitante é identificado por um token aleatório. ------------

create function public.public_chat_send(p_slug text, p_visitor text, p_name text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_conversation uuid;
  v_customer uuid;
begin
  if length(p_visitor) < 32 or length(trim(p_body)) = 0 or length(p_body) > 2000 then
    raise exception 'Mensagem inválida';
  end if;
  select id into v_company from public.companies where slug = p_slug;
  if v_company is null then
    raise exception 'Empresa não encontrada';
  end if;
  select id into v_conversation from public.conversations
  where company_id = v_company and channel = 'site' and external_id = p_visitor;
  -- Proteção contra spam: até 10 mensagens por minuto por visitante.
  if v_conversation is not null and (
    select count(*) from public.messages m
    where m.conversation_id = v_conversation and m.direction = 'entrada'
      and m.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'Muitas mensagens seguidas. Aguarde um minuto.';
  end if;
  if v_conversation is null then
    insert into public.customers (company_id, name, tags)
    values (v_company, coalesce(nullif(trim(p_name), ''), 'Visitante do site'), array['Site'])
    returning id into v_customer;
    insert into public.conversations (company_id, customer_id, channel, external_id)
    values (v_company, v_customer, 'site', p_visitor)
    returning id into v_conversation;
    insert into public.messages (company_id, conversation_id, direction, body, created_at)
    values (v_company, v_conversation, 'sistema', 'Conversa iniciada pelo chat do site', now() - interval '1 millisecond');
  end if;
  insert into public.messages (company_id, conversation_id, direction, body)
  values (v_company, v_conversation, 'entrada', trim(p_body));
end;
$$;

create function public.public_chat_messages(p_visitor text)
returns table (direction message_direction, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.direction, m.body, m.created_at
  from public.messages m join public.conversations c on c.id = m.conversation_id
  where c.channel = 'site' and c.external_id = p_visitor and length(p_visitor) >= 32
    and m.direction <> 'sistema'
  order by m.created_at;
$$;

-- Gestão do agendamento pelo cliente final (link dos lembretes) ------------------------------

create function public.public_appointment(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'price_cents', a.price_cents,
    'service_id', s.id, 'service', s.name, 'duration_min', s.duration_min,
    'professional_id', p.id, 'professional', p.name,
    'customer', split_part(cu.name, ' ', 1),
    'company', c.name, 'slug', c.slug, 'primary_color', c.primary_color, 'logo_url', c.logo_url, 'timezone', c.timezone,
    'address', (select concat_ws(', ', u.address_line, u.city, u.state) from public.units u where u.company_id = c.id order by u.created_at limit 1)
  )
  from public.appointments a
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  join public.customers cu on cu.id = a.customer_id
  join public.companies c on c.id = a.company_id
  where a.manage_token = p_token;
$$;

create function public.public_reschedule(p_token text, p_starts_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_slug text;
  v_tz text;
begin
  select * into v_appt from public.appointments
  where manage_token = p_token and status in ('agendado', 'confirmado') and starts_at > now();
  if v_appt.id is null then
    raise exception 'Este agendamento não pode mais ser remarcado';
  end if;
  select slug, timezone into v_slug, v_tz from public.companies where id = v_appt.company_id;
  if not exists (
    select 1 from public.public_available_slots(v_slug, v_appt.service_id, v_appt.professional_id,
      (p_starts_at at time zone v_tz)::date, p_token) s
    where s = p_starts_at
  ) then
    raise exception 'Horário não está mais disponível';
  end if;
  update public.appointments
  set starts_at = p_starts_at,
      ends_at = p_starts_at + (v_appt.ends_at - v_appt.starts_at),
      status = 'agendado'
  where id = v_appt.id;
end;
$$;

grant execute on function public.public_chat_send, public.public_chat_messages,
  public.public_appointment, public.public_reschedule to anon, authenticated;

-- Aniversário e retorno --------------------------------------------------------------------
-- Rodada uma vez por dia pelo pg_cron (ver README); a Edge Function send-reminders envia.

create function public.enqueue_marketing_messages() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_rows integer;
begin
  -- Aniversariantes do dia, às 9h no fuso da empresa.
  insert into public.notification_jobs (company_id, customer_id, kind, channel, scheduled_for, dedupe_key)
  select c.company_id, c.id, 'aniversario', t.channel,
    ((now() at time zone co.timezone)::date + time '09:00') at time zone co.timezone,
    'aniversario:' || c.id || ':' || t.channel || ':' || extract(year from now() at time zone co.timezone)
  from public.customers c
  join public.companies co on co.id = c.company_id
  join public.message_templates t on t.company_id = c.company_id and t.kind = 'aniversario' and t.active
  where c.birth_date is not null
    and to_char(c.birth_date, 'MM-DD') = to_char(now() at time zone co.timezone, 'MM-DD')
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Retorno: última visita concluída há 30 dias e nada marcado depois.
  insert into public.notification_jobs (company_id, customer_id, kind, channel, scheduled_for, dedupe_key)
  select c.company_id, c.id, 'retorno', t.channel,
    ((now() at time zone co.timezone)::date + time '10:00') at time zone co.timezone,
    'retorno:' || c.id || ':' || t.channel || ':' || last.day
  from public.customers c
  join public.companies co on co.id = c.company_id
  join public.message_templates t on t.company_id = c.company_id and t.kind = 'retorno' and t.active
  cross join lateral (
    select max((a.starts_at at time zone co.timezone)::date) as day from public.appointments a
    where a.customer_id = c.id and a.status = 'concluido'
  ) last
  where last.day = (now() at time zone co.timezone)::date - 30
    and not exists (
      select 1 from public.appointments a
      where a.customer_id = c.id and a.starts_at > now() and a.status in ('agendado', 'confirmado')
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  return v_count + v_rows;
end;
$$;

-- Tempo real também para as notificações internas.
alter publication supabase_realtime add table internal_notifications;

-- Logos das empresas (bucket público, escrita só pelo admin da empresa). -----------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
    on conflict (id) do nothing;
    execute $p$create policy "logos: leitura pública" on storage.objects for select
      using (bucket_id = 'logos')$p$;
    execute $p$create policy "logos: admin envia" on storage.objects for insert
      with check (bucket_id = 'logos' and public.is_admin(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy "logos: admin troca" on storage.objects for update
      using (bucket_id = 'logos' and public.is_admin(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end;
$$;

-- Onboarding: confere se o endereço público está livre.
create function public.slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(p_slug) between 3 and 60
    and not p_slug = any (array[
      'painel', 'agenda', 'fila', 'atendimentos', 'clientes', 'equipe', 'servicos', 'financeiro',
      'relatorios', 'configuracoes', 'entrar', 'cadastrar', 'recuperar-senha', 'nova-senha',
      'onboarding', 'auth', 'tv', 'agendamento', 'convite', 'api', 'planos', 'demo', 'termos'
    ])
    and not exists (select 1 from public.companies where slug = p_slug);
$$;
grant execute on function public.slug_available to anon, authenticated;

-- A página pública mostra aviso em vez do agendamento quando a conta está inativa.
create or replace function public.public_booking_open(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_active_plan(id) from public.companies where slug = p_slug;
$$;
grant execute on function public.public_booking_open to anon, authenticated;

-- Modelo aprovado na Meta para a API oficial do WhatsApp: fora da janela de 24h
-- só mensagens de modelo são entregues. provider_params lista, na ordem dos
-- {{1}}, {{2}}..., as variáveis do Balcão (nome, data, hora, servico,
-- profissional, empresa, link).
alter table message_templates
  add column provider_template text,
  add column provider_params text[] not null default '{}';
