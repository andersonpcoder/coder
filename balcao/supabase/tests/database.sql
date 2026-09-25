-- Testes do banco: isolamento por empresa, papéis, regras de agenda e funções públicas.
-- Rode com: npm run test:db   (precisa de um Postgres 15+ com as extensões contrib)
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\pset format unaligned

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
revoke select on integrations from authenticated;
grant select (id, company_id, provider, settings, active) on integrations to authenticated;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALHOU: %', what; end if;
  raise notice 'ok: %', what;
end;
$$;

create or replace function pg_temp.fails(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FALHOU (deveria recusar): %', what;
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: % (%)', what, left(sqlerrm, 70);
end;
$$;

create or replace function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dona@aurora.test', '{"full_name":"Dona Aurora"}'),
  ('22222222-2222-2222-2222-222222222222', 'outra@empresa.test', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'marina@aurora.test', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'recepcao@aurora.test', '{}');

insert into memberships values
  ('00000000-0000-0000-0000-00000000c001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('00000000-0000-0000-0000-00000000c001', '33333333-3333-3333-3333-333333333333', 'profissional'),
  ('00000000-0000-0000-0000-00000000c001', '44444444-4444-4444-4444-444444444444', 'recepcao');
update professionals set user_id = '33333333-3333-3333-3333-333333333333' where name = 'Marina Costa';

select pg_temp.check((select full_name from profiles where id = '11111111-1111-1111-1111-111111111111') = 'Dona Aurora',
  'perfil criado junto com o usuário');

-- Regras do banco sem RLS -------------------------------------------------------
select pg_temp.fails($$
  insert into appointments (company_id, professional_id, service_id, customer_id, starts_at, ends_at)
  select company_id, professional_id, service_id, customer_id, starts_at + interval '5 minutes', ends_at
  from appointments where status = 'agendado' limit 1 $$, 'dois horários sobrepostos do mesmo profissional');

select pg_temp.check((
  select count(*) = 3 from notification_jobs j join appointments a on a.id = j.appointment_id
  where a.status = 'agendado' and a.starts_at > now() + interval '1 day'
  group by a.id limit 1), 'lembretes 24h (WhatsApp e e-mail) e 2h criados para cada agendamento');

select pg_temp.check(normalize_phone('+55 (11) 98888-7777') = '11988887777', 'telefone normalizado sem o 55');

-- Isolamento e papéis -------------------------------------------------------------
set role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from appointments) = 0, 'outra empresa não vê agendamentos');
select pg_temp.check((select count(*) from customers) = 0, 'outra empresa não vê clientes');
select pg_temp.fails($$ select create_company('Teste', 'agenda', 'barbearia') $$, 'link reservado recusado');
select pg_temp.check(create_company('Barbearia do Zé', 'barbearia-do-ze', 'barbearia') is not null, 'onboarding cria a empresa');
select pg_temp.check((select count(*) from companies) = 1, 'nova empresa vê só a si mesma');
select pg_temp.check((select count(*) from quick_replies) = 3, 'respostas rápidas padrão criadas');
select pg_temp.check(not slug_available('barbearia-do-ze') and slug_available('outro-link'), 'slug_available');

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(distinct professional_id) from appointments) = 1, 'profissional vê só a própria agenda');
select pg_temp.check((select count(*) from payments) = (select count(*) from payments p join professionals pr on pr.id = p.professional_id where pr.name = 'Marina Costa'),
  'profissional vê só os próprios pagamentos');
select pg_temp.check((select count(*) from subscriptions) = 0, 'profissional não vê a assinatura');
select pg_temp.fails($$ insert into services (company_id, name, duration_min) values ('00000000-0000-0000-0000-00000000c001', 'X', 30) $$,
  'profissional não cadastra serviço');

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.check((select count(distinct professional_id) from appointments) = 5, 'recepção vê a agenda toda');
select pg_temp.check((select count(*) from payments where paid_at < now() - interval '2 days') = 0, 'recepção vê só o caixa do dia');
select pg_temp.fails($$ select secret from integrations $$, 'token das integrações nunca é lido pelo navegador');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check((select count(*) from payments where paid_at < now() - interval '2 days') > 0, 'admin vê todo o financeiro');
select pg_temp.check(effective_plan('00000000-0000-0000-0000-00000000c001') = 'empresa', 'teste grátis vale como plano Empresa');

reset role;

-- Limites de plano -------------------------------------------------------------------
update subscriptions set plan = 'basico', status = 'ativa' where company_id = '00000000-0000-0000-0000-00000000c001';
select pg_temp.fails($$ insert into professionals (company_id, name) values ('00000000-0000-0000-0000-00000000c001', 'Sexto') $$,
  'plano Básico limita profissionais');
select pg_temp.fails($$ insert into units (company_id, name) values ('00000000-0000-0000-0000-00000000c001', 'Filial') $$,
  'várias unidades só no plano Empresa');
update subscriptions set plan = 'empresa' where company_id = '00000000-0000-0000-0000-00000000c001';

-- Página pública (anônimo) -----------------------------------------------------------
set role anon;
select pg_temp.as_user(null);

create temp table t (token text, slot timestamptz) on commit preserve rows;
grant all on t to anon;
insert into t (slot)
select s from public_available_slots('estudio-aurora', '00000000-0000-0000-0000-0000000005a2',
  '00000000-0000-0000-0000-0000000000b2', current_date + 3) s order by s limit 1;

select pg_temp.check((select slot from t) is not null, 'horários livres para amanhã e depois');
select pg_temp.fails($$ select public_book('estudio-aurora', '00000000-0000-0000-0000-0000000005a2',
  '00000000-0000-0000-0000-0000000000b2', (select slot from t), 'Ana', '11912345678', false) $$, 'agendar sem consentimento LGPD');
select pg_temp.fails($$ select public_book('estudio-aurora', '00000000-0000-0000-0000-0000000005a6',
  '00000000-0000-0000-0000-0000000000b2', (select slot from t), 'Ana', '11912345678', true) $$, 'profissional que não faz o serviço');
update t set token = public_book('estudio-aurora', '00000000-0000-0000-0000-0000000005a2',
  '00000000-0000-0000-0000-0000000000b2', slot, 'Ana Pública', '+55 11 91234-5678', true);
select pg_temp.check(length((select token from t)) = 32, 'agendamento pela página pública');
select pg_temp.fails($$ select public_book('estudio-aurora', '00000000-0000-0000-0000-0000000005a2',
  '00000000-0000-0000-0000-0000000000b2', (select slot from t), 'Outro', '11900000000', true) $$, 'mesmo horário não pode ser reservado duas vezes');
select pg_temp.check((public_appointment((select token from t)) ->> 'customer') = 'Ana', 'cliente vê o próprio agendamento');
select public_confirm((select token from t));
select pg_temp.check((public_appointment((select token from t)) ->> 'status') = 'confirmado', 'cliente confirma');
select public_reschedule((select token from t), (
  select s from public_available_slots('estudio-aurora', '00000000-0000-0000-0000-0000000005a2',
    '00000000-0000-0000-0000-0000000000b2', current_date + 3, (select token from t)) s
  where s <> (select slot from t) order by s desc limit 1));
select pg_temp.check((public_appointment((select token from t)) ->> 'status') = 'agendado', 'cliente remarca');
select public_cancel((select token from t));
select pg_temp.check((public_appointment((select token from t)) ->> 'status') = 'cancelado', 'cliente cancela');

-- Chat do site
select public_chat_send('estudio-aurora', repeat('v', 40), 'Visitante', 'Oi!');
select pg_temp.check((select count(*) from public_chat_messages(repeat('v', 40))) = 1, 'chat do site grava a mensagem');
select pg_temp.check((select count(*) from public_chat_messages(repeat('x', 40))) = 0, 'outro visitante não vê a conversa');
select pg_temp.fails($$ select public_chat_send('estudio-aurora', 'curto', 'x', 'oi') $$, 'token de visitante curto recusado');
select public_chat_send('estudio-aurora', repeat('v', 40), '', 'msg ' || g) from generate_series(1, 9) g;
select pg_temp.fails($$ select public_chat_send('estudio-aurora', repeat('v', 40), '', 'spam') $$, 'limite de mensagens por minuto');

reset role;
select pg_temp.check((select unread_count from conversations where external_id = repeat('v', 40)) = 10, 'mensagens contam como não lidas');

-- Convites
insert into invites (company_id, role, token) values ('00000000-0000-0000-0000-00000000c001', 'recepcao', 'convite-teste');
set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(accept_invite('convite-teste') is not null, 'aceitar convite');
select pg_temp.check((select count(*) from companies) = 2, 'convite aceito dá acesso à empresa');
select pg_temp.fails($$ select accept_invite('convite-teste') $$, 'convite não pode ser usado duas vezes');
reset role;

-- Aniversário sem duplicar
update customers set birth_date = (now() at time zone 'America/Sao_Paulo')::date - interval '30 years' where name = 'Beatriz Santos';
select pg_temp.check(enqueue_marketing_messages() >= 1, 'mensagem de aniversário gerada');
select pg_temp.check(enqueue_marketing_messages() = 0, 'aniversário não duplica');

-- LGPD
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check((export_customer_data((select id from customers where name = 'Beatriz Santos')) -> 'agendamentos') is not null, 'exportar dados do cliente');
select delete_customer_data((select id from customers where name = 'Beatriz Santos'));
select pg_temp.check(not exists (select 1 from customers where name = 'Beatriz Santos'), 'excluir dados do cliente');
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.fails($$ select export_customer_data((select id from customers limit 1)) $$, 'só o admin exporta dados');
reset role;

\echo 'Todos os testes do banco passaram.'
