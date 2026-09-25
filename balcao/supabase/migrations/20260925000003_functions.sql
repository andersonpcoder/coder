-- Balcão: funções de negócio (onboarding, fila, página pública e lembretes).

-- Onboarding: cria empresa, unidade principal, assinatura de teste e o admin.
create function public.create_company(
  p_name text,
  p_slug text,
  p_segment text,
  p_timezone text default 'America/Sao_Paulo',
  p_business_hours jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado';
  end if;
  -- O link público é balcao.app/<slug>; não pode colidir com as rotas do app.
  if p_slug = any (array[
    'painel', 'agenda', 'fila', 'atendimentos', 'clientes', 'equipe', 'servicos', 'financeiro',
    'relatorios', 'configuracoes', 'entrar', 'cadastrar', 'recuperar-senha', 'nova-senha',
    'onboarding', 'auth', 'tv', 'agendamento', 'convite', 'api', 'planos', 'demo', 'termos'
  ]) then
    raise exception 'Este endereço é reservado. Escolha outro.';
  end if;

  insert into public.companies (name, slug, segment, timezone)
  values (p_name, p_slug, p_segment, p_timezone)
  returning id into v_company;

  insert into public.units (company_id, name, business_hours)
  values (v_company, 'Unidade principal', p_business_hours);

  insert into public.memberships (company_id, user_id, role)
  values (v_company, auth.uid(), 'admin');

  insert into public.subscriptions (company_id) values (v_company);

  insert into public.quick_replies (company_id, title, body) values
    (v_company, 'Endereço', 'Estamos em {endereco}. Qualquer dúvida é só chamar!'),
    (v_company, 'Confirmar agendamento', 'Seu horário está confirmado para {data} às {hora}.'),
    (v_company, 'Enviar horários disponíveis', 'Tenho estes horários livres: {horarios}. Qual prefere?');

  insert into public.message_templates (company_id, kind, channel, body) values
    (v_company, 'lembrete_24h', 'whatsapp', 'Olá, {nome}! Lembrete: amanhã às {hora} você tem {servico} com {profissional}. Responda 1 para confirmar.'),
    (v_company, 'lembrete_2h', 'whatsapp', 'Oi, {nome}! Te esperamos hoje às {hora}. Até já!'),
    (v_company, 'lembrete_24h', 'email', 'Olá, {nome}. Seu horário de {servico} é amanhã às {hora}.'),
    (v_company, 'aniversario', 'whatsapp', 'Feliz aniversário, {nome}! Temos um presente para você na próxima visita.'),
    (v_company, 'retorno', 'whatsapp', 'Oi, {nome}! Faz 30 dias da sua última visita. Que tal agendar?');

  return v_company;
end;
$$;

-- Senha da fila: A = agendado, E = encaixe, numeração reinicia por dia.
create function public.next_queue_ticket(p_company uuid, p_walk_in boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if not public.is_staff(p_company) then
    raise exception 'Sem permissão';
  end if;
  select count(*) + 1 into v_count from public.queue_entries q
  where q.company_id = p_company
    and q.is_walk_in = p_walk_in
    and q.checked_in_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  return (case when p_walk_in then 'E' else 'A' end) || lpad(v_count::text, 3, '0');
end;
$$;

-- Telefone só com dígitos e sem o código do país, como o app guarda.
create function public.normalize_phone(p_phone text) returns text
language sql immutable as $$
  select case
    when d ~ '^55\d{10,11}$' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x;
$$;

-- Página pública ----------------------------------------------------------------
-- O cliente final não tem login: as funções abaixo expõem só o necessário.

create function public.public_company(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'primary_color', c.primary_color,
    'timezone', c.timezone,
    'address', (select concat_ws(', ', u.address_line, u.city, u.state) from public.units u where u.company_id = c.id order by u.created_at limit 1),
    'phone', (select u.phone from public.units u where u.company_id = c.id order by u.created_at limit 1),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category, 'duration_min', s.duration_min, 'price_cents', s.price_cents) order by s.category, s.name)
      from public.services s where s.company_id = c.id and s.active), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url,
        'role_title', p.role_title,
        'service_ids', coalesce((select jsonb_agg(ps.service_id) from public.professional_services ps where ps.professional_id = p.id), '[]'::jsonb)
      ) order by p.name)
      from public.professionals p where p.company_id = c.id and p.active), '[]'::jsonb)
  )
  from public.companies c where c.slug = p_slug;
$$;

-- Horários livres de um profissional num dia, em intervalos de 15 minutos.
create function public.public_available_slots(
  p_slug text, p_service uuid, p_professional uuid, p_day date, p_ignore_token text default null
) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_company public.companies;
  v_duration integer;
begin
  select * into v_company from public.companies where slug = p_slug;
  select duration_min into v_duration from public.services
  where id = p_service and company_id = v_company.id and active;
  if v_duration is null or not exists (
    select 1 from public.professional_services ps
    join public.professionals p on p.id = ps.professional_id
    where ps.professional_id = p_professional and ps.service_id = p_service and p.active
  ) then
    return;
  end if;

  return query
  select slot
  from public.work_hours wh
  cross join lateral generate_series(
    (p_day + wh.start_time) at time zone v_company.timezone,
    (p_day + wh.end_time) at time zone v_company.timezone - make_interval(mins => v_duration),
    interval '15 minutes'
  ) as slot
  where wh.professional_id = p_professional
    and wh.company_id = v_company.id
    and wh.weekday = extract(dow from p_day)
    and slot > now()
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = p_professional
        and a.status not in ('cancelado', 'faltou')
        and a.manage_token is distinct from p_ignore_token
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(slot, slot + make_interval(mins => v_duration))
    )
    and not exists (
      select 1 from public.time_blocks b
      where b.company_id = v_company.id
        and (b.professional_id is null or b.professional_id = p_professional)
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(slot, slot + make_interval(mins => v_duration))
    )
  order by slot;
end;
$$;

-- Cria o agendamento pela página pública. Retorna o token de gestão.
create function public.public_book(
  p_slug text, p_service uuid, p_professional uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_consent boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_service public.services;
  v_customer uuid;
  v_token text;
begin
  if not p_consent then
    raise exception 'É preciso aceitar o termo de consentimento (LGPD)';
  end if;
  select id into v_company from public.companies where slug = p_slug;
  select * into v_service from public.services where id = p_service and company_id = v_company and active;
  if v_service.id is null then
    raise exception 'Serviço indisponível';
  end if;
  if not exists (
    select 1 from public.public_available_slots(p_slug, p_service, p_professional, (p_starts_at at time zone 'America/Sao_Paulo')::date) s
    where s = p_starts_at
  ) then
    raise exception 'Horário não está mais disponível';
  end if;

  -- Proteção contra abuso: no máximo 3 horários futuros por telefone.
  if (
    select count(*) from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.company_id = v_company
      and c.phone = public.normalize_phone(p_phone)
      and a.status in ('agendado', 'confirmado')
      and a.starts_at > now()
  ) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Para mais, fale com o estabelecimento.';
  end if;
  if length(public.normalize_phone(p_phone)) not between 10 and 11 or length(trim(p_name)) < 2 then
    raise exception 'Informe nome e WhatsApp com DDD';
  end if;

  insert into public.customers (company_id, name, phone, lgpd_consent_at)
  values (v_company, trim(p_name), public.normalize_phone(p_phone), now())
  on conflict (company_id, phone) where phone is not null
  do update set lgpd_consent_at = now()
  returning id into v_customer;

  insert into public.consent_logs (company_id, customer_id, terms_version, source)
  values (v_company, v_customer, '2026-09', 'site');

  insert into public.appointments (
    company_id, professional_id, service_id, customer_id, starts_at, ends_at, price_cents, channel
  ) values (
    v_company, p_professional, p_service, v_customer, p_starts_at,
    p_starts_at + make_interval(mins => v_service.duration_min), v_service.price_cents, 'site'
  ) returning manage_token into v_token;

  return v_token;
end;
$$;

create function public.public_cancel(p_token text) returns void
language sql security definer set search_path = '' as $$
  update public.appointments set status = 'cancelado'
  where manage_token = p_token and status in ('agendado', 'confirmado') and starts_at > now();
$$;

create function public.public_confirm(p_token text) returns void
language sql security definer set search_path = '' as $$
  update public.appointments set status = 'confirmado'
  where manage_token = p_token and status = 'agendado';
$$;

grant execute on function public.public_company, public.public_available_slots,
  public.public_book, public.public_cancel, public.public_confirm to anon, authenticated;

-- Lembretes ----------------------------------------------------------------------
-- Cada agendamento gera envios de 24h e 2h antes. A Edge Function send-reminders
-- (agendada pelo pg_cron) processa os pendentes.

create function public.enqueue_reminders() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelado', 'faltou') then
    update public.notification_jobs set status = 'cancelado'
    where appointment_id = new.id and status = 'pendente';
    return new;
  end if;

  if tg_op = 'UPDATE' and new.starts_at = old.starts_at then
    return new;
  end if;

  insert into public.notification_jobs (company_id, appointment_id, customer_id, kind, channel, scheduled_for)
  select new.company_id, new.id, new.customer_id, k.kind, k.channel, new.starts_at - k.lead
  from (values
    ('lembrete_24h'::public.notification_kind, 'whatsapp'::public.notification_channel, interval '24 hours'),
    ('lembrete_24h', 'email', interval '24 hours'),
    ('lembrete_2h', 'whatsapp', interval '2 hours')
  ) as k (kind, channel, lead)
  where new.starts_at - k.lead > now()
  on conflict (appointment_id, kind, channel)
  do update set scheduled_for = excluded.scheduled_for, status = 'pendente', attempts = 0;

  return new;
end;
$$;

create trigger appointments_reminders after insert or update of starts_at, status on appointments
  for each row execute function public.enqueue_reminders();

-- Notificações internas para novo agendamento e cancelamento.
create function public.notify_appointment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_customer text;
begin
  select name into v_customer from public.customers where id = new.customer_id;
  if tg_op = 'INSERT' then
    insert into public.internal_notifications (company_id, kind, title, body, link)
    values (new.company_id, 'novo_agendamento', 'Novo agendamento',
      v_customer || ' em ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/agenda');
  elsif new.status = 'cancelado' and old.status <> 'cancelado' then
    insert into public.internal_notifications (company_id, kind, title, body, link)
    values (new.company_id, 'cancelamento', 'Agendamento cancelado',
      v_customer || ' cancelou ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/agenda');
  end if;
  return new;
end;
$$;

create trigger appointments_notify after insert or update of status on appointments
  for each row execute function public.notify_appointment_change();

-- LGPD: exportar e excluir dados de um cliente (apenas admin).
create function public.export_customer_data(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.customers where id = p_customer;
  if not public.is_admin(v_company) then
    raise exception 'Sem permissão';
  end if;
  return jsonb_build_object(
    'cliente', (select to_jsonb(c) from public.customers c where c.id = p_customer),
    'agendamentos', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.appointments a where a.customer_id = p_customer),
    'pagamentos', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.payments p where p.customer_id = p_customer),
    'mensagens', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.messages m
      join public.conversations cv on cv.id = m.conversation_id where cv.customer_id = p_customer),
    'consentimentos', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.consent_logs l where l.customer_id = p_customer)
  );
end;
$$;

create function public.delete_customer_data(p_customer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.customers where id = p_customer;
  if not public.is_admin(v_company) then
    raise exception 'Sem permissão';
  end if;
  delete from public.conversations where customer_id = p_customer;
  -- Pagamentos ficam por obrigação fiscal, mas sem vínculo com a pessoa.
  update public.payments set customer_id = null where customer_id = p_customer;
  delete from public.customers where id = p_customer;
end;
$$;
