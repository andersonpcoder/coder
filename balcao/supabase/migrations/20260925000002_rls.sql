-- Balcão: isolamento por empresa (Row Level Security) e permissões por papel.
--
-- Administrador: tudo. Recepção: operação (agenda, fila, conversas, clientes) e
-- o caixa do dia. Profissional: só a própria agenda e os próprios clientes.

create function public.my_role(target_company uuid) returns member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  where m.company_id = target_company and m.user_id = auth.uid();
$$;

create function public.is_member(target_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

create function public.is_staff(target_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_role(target_company) in ('admin', 'recepcao');
$$;

create function public.is_admin(target_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_role(target_company) = 'admin';
$$;

create function public.my_professional_id(target_company uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.professionals p
  where p.company_id = target_company and p.user_id = auth.uid()
    and public.is_member(target_company);
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'units', 'profiles', 'memberships', 'professionals', 'work_hours',
    'services', 'professional_services', 'customers', 'consent_logs',
    'appointments', 'time_blocks', 'queue_entries', 'conversations',
    'messages', 'quick_replies', 'payments', 'message_templates', 'notification_jobs',
    'internal_notifications', 'subscriptions', 'integrations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Empresa e cadastro --------------------------------------------------------------

create policy "membros leem a empresa" on companies for select using (is_member(id));
create policy "admin altera a empresa" on companies for update using (is_admin(id));

create policy "membros leem unidades" on units for select using (is_member(company_id));
create policy "admin gerencia unidades" on units for all
  using (is_admin(company_id)) with check (is_admin(company_id));

create policy "perfil próprio" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "colegas leem perfis" on profiles for select using (
  exists (
    select 1 from memberships a join memberships b on a.company_id = b.company_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);

create policy "membros leem membros" on memberships for select using (is_member(company_id));
create policy "admin gerencia membros" on memberships for all
  using (is_admin(company_id)) with check (is_admin(company_id));

-- Tabelas de referência: todos os membros leem, só o admin altera.
do $$
declare
  t text;
begin
  foreach t in array array[
    'professionals', 'work_hours', 'services',
    'professional_services', 'quick_replies', 'message_templates'
  ] loop
    execute format(
      'create policy "membros leem" on public.%I for select using (public.is_member(company_id))', t);
    execute format(
      'create policy "admin gerencia" on public.%I for all using (public.is_admin(company_id)) with check (public.is_admin(company_id))', t);
  end loop;
end;
$$;

-- Clientes: equipe vê todos; profissional vê quem já atendeu ou vai atender.
create policy "equipe gerencia clientes" on customers for all
  using (is_staff(company_id)) with check (is_staff(company_id));
create policy "profissional lê seus clientes" on customers for select using (
  exists (
    select 1 from appointments a
    where a.customer_id = customers.id
      and a.professional_id = my_professional_id(customers.company_id)
  )
);
create policy "equipe lê consentimentos" on consent_logs for select using (is_staff(company_id));

-- Agenda --------------------------------------------------------------------------

create policy "equipe gerencia agendamentos" on appointments for all
  using (is_staff(company_id)) with check (is_staff(company_id));
create policy "profissional lê a própria agenda" on appointments for select
  using (professional_id = my_professional_id(company_id));
-- O profissional pode atualizar os próprios atendimentos (ex.: marcar concluído).
create policy "profissional atualiza a própria agenda" on appointments for update
  using (professional_id = my_professional_id(company_id))
  with check (professional_id = my_professional_id(company_id));

create policy "membros leem bloqueios" on time_blocks for select using (is_member(company_id));
create policy "equipe gerencia bloqueios" on time_blocks for all
  using (is_staff(company_id)) with check (is_staff(company_id));
create policy "profissional bloqueia a própria agenda" on time_blocks for all
  using (professional_id = my_professional_id(company_id))
  with check (professional_id = my_professional_id(company_id));

-- Fila ----------------------------------------------------------------------------

create policy "equipe gerencia a fila" on queue_entries for all
  using (is_staff(company_id)) with check (is_staff(company_id));
create policy "profissional vê a fila" on queue_entries for select using (is_member(company_id));
create policy "profissional atende da fila" on queue_entries for update
  using (professional_id = my_professional_id(company_id));

-- Conversas -----------------------------------------------------------------------

create policy "equipe gerencia conversas" on conversations for all
  using (is_staff(company_id)) with check (is_staff(company_id));
create policy "atendente vê conversas atribuídas" on conversations for select
  using (assigned_to = auth.uid());
create policy "equipe gerencia mensagens" on messages for all
  using (is_staff(company_id)) with check (is_staff(company_id));

-- Financeiro: admin vê tudo; recepção registra e vê só o caixa do dia.
create policy "admin gerencia pagamentos" on payments for all
  using (is_admin(company_id)) with check (is_admin(company_id));
create policy "recepção registra pagamentos" on payments for insert
  with check (is_staff(company_id));
create policy "recepção vê o caixa do dia" on payments for select using (
  is_staff(company_id)
  and paid_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
);
create policy "profissional vê os próprios pagamentos" on payments for select
  using (professional_id = my_professional_id(company_id));

-- Notificações, plano e integrações ------------------------------------------------

create policy "admin vê fila de envios" on notification_jobs for select using (is_admin(company_id));
create policy "usuário lê suas notificações" on internal_notifications for select
  using (is_member(company_id) and (user_id is null or user_id = auth.uid()));
create policy "usuário marca como lida" on internal_notifications for update
  using (is_member(company_id) and (user_id is null or user_id = auth.uid()));
create policy "admin vê assinatura" on subscriptions for select using (is_admin(company_id));
create policy "admin gerencia integrações" on integrations for all
  using (is_admin(company_id)) with check (is_admin(company_id));

-- Tempo real para fila, conversas e mensagens.
alter publication supabase_realtime add table queue_entries, conversations, messages, appointments;
