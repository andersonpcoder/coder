-- Dados de exemplo do Balcão (Estúdio Aurora), gerados em torno da data atual.
-- Rode depois das migrações: `supabase db reset` aplica este arquivo sozinho.

select setseed(0.25);

insert into companies (id, name, slug, segment) values
  ('00000000-0000-0000-0000-00000000c001', 'Estúdio Aurora', 'estudio-aurora', 'salao');

insert into units (id, company_id, name, phone, address_line, city, state, business_hours) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 'Pinheiros',
   '11987654321', 'Rua das Palmeiras, 240', 'São Paulo', 'SP',
   '{"1":[{"inicio":"08:00","fim":"20:00"}],"2":[{"inicio":"08:00","fim":"20:00"}],"3":[{"inicio":"08:00","fim":"20:00"}],"4":[{"inicio":"08:00","fim":"20:00"}],"5":[{"inicio":"08:00","fim":"20:00"}],"6":[{"inicio":"09:00","fim":"18:00"}]}');

insert into subscriptions (company_id, plan, status) values
  ('00000000-0000-0000-0000-00000000c001', 'profissional', 'teste');

insert into services (id, company_id, name, duration_min, price_cents, color) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000c001', 'Corte feminino', 60, 12000, 'lavanda'),
  ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-00000000c001', 'Corte masculino', 30, 5500, 'ceu'),
  ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-00000000c001', 'Barba', 30, 4000, 'areia'),
  ('00000000-0000-0000-0000-0000000005a4', '00000000-0000-0000-0000-00000000c001', 'Coloração', 120, 28000, 'rosa'),
  ('00000000-0000-0000-0000-0000000005a5', '00000000-0000-0000-0000-00000000c001', 'Escova', 45, 7000, 'pessego'),
  ('00000000-0000-0000-0000-0000000005a6', '00000000-0000-0000-0000-00000000c001', 'Manicure', 45, 4500, 'menta'),
  ('00000000-0000-0000-0000-0000000005a7', '00000000-0000-0000-0000-00000000c001', 'Pedicure', 60, 5500, 'menta'),
  ('00000000-0000-0000-0000-0000000005a8', '00000000-0000-0000-0000-00000000c001', 'Design de sobrancelha', 30, 5000, 'pessego');

insert into professionals (id, company_id, unit_id, name, role_title, commission_pct) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Marina Costa', 'Cabeleireira', 40),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Rafael Lima', 'Barbeiro', 45),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Juliana Alves', 'Manicure', 50),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Bruno Tavares', 'Barbeiro', 45),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'Camila Rocha', 'Colorista', 40);

insert into professional_services (company_id, professional_id, service_id)
select '00000000-0000-0000-0000-00000000c001', p::uuid, s::uuid from (values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000005a1'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000005a5'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000005a4'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000005a2'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000005a3'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000005a6'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000005a7'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000005a8'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000005a2'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000005a3'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000005a8'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000005a4'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000005a5'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000005a1')
) as t (p, s);

-- Expediente: Marina e Bruno de terça a sábado, Juliana de segunda a sexta,
-- Rafael e Camila de segunda a sábado.
insert into work_hours (company_id, professional_id, weekday, start_time, end_time)
select '00000000-0000-0000-0000-00000000c001', p::uuid, d, s::time, e::time
from (values
  ('00000000-0000-0000-0000-0000000000b1', array[2,3,4,5,6], '09:00', '19:00'),
  ('00000000-0000-0000-0000-0000000000b2', array[1,2,3,4,5,6], '09:00', '18:00'),
  ('00000000-0000-0000-0000-0000000000b3', array[1,2,3,4,5], '08:00', '17:00'),
  ('00000000-0000-0000-0000-0000000000b4', array[2,3,4,5,6], '10:00', '20:00'),
  ('00000000-0000-0000-0000-0000000000b5', array[1,2,3,4,5,6], '09:00', '18:00')
) as t (p, days, s, e)
cross join unnest(days) as d;

insert into customers (company_id, name, phone, email, tags, lgpd_consent_at)
select '00000000-0000-0000-0000-00000000c001', name, phone,
  lower(split_part(unaccent_name, ' ', 1)) || '@email.com', tags, now()
from (values
  ('Beatriz Santos', 'Beatriz Santos', '11991234567', array['VIP']),
  ('Carlos Eduardo Nunes', 'Carlos Eduardo Nunes', '11992345678', array['Mensalista']),
  ('Fernanda Oliveira', 'Fernanda Oliveira', '11993456789', array[]::text[]),
  ('Gabriel Martins', 'Gabriel Martins', '11994567890', array['Novo']),
  ('Helena Ribeiro', 'Helena Ribeiro', '11995678901', array['VIP']),
  ('Igor Fernandes', 'Igor Fernandes', '11996789012', array[]::text[]),
  ('Larissa Gomes', 'Larissa Gomes', '11997890123', array['Indicação']),
  ('Lucas Pereira', 'Lucas Pereira', '11998901234', array['Mensalista']),
  ('Mariana Duarte', 'Mariana Duarte', '11999012345', array[]::text[]),
  ('Mateus Carvalho', 'Mateus Carvalho', '11990123456', array['Faltoso']),
  ('Patrícia Moura', 'Patricia Moura', '11981234567', array[]::text[]),
  ('Rafaela Teixeira', 'Rafaela Teixeira', '11983456789', array['VIP']),
  ('Sofia Almeida', 'Sofia Almeida', '11985678901', array['Indicação']),
  ('Vinícius Rocha', 'Vinicius Rocha', '11988901234', array[]::text[])
) as t (name, unaccent_name, phone, tags);

-- Almoço de cada profissional e agendamentos de 14 dias antes a 14 dias depois.
do $$
declare
  v_company constant uuid := '00000000-0000-0000-0000-00000000c001';
  v_tz constant text := 'America/Sao_Paulo';
  v_day date;
  v_wh record;
  v_cursor time;
  v_lunch time;
  v_service record;
  v_customer uuid;
  v_start timestamptz;
  v_status appointment_status;
  v_channel booking_channel;
begin
  for v_day in select generate_series(current_date - 14, current_date + 14, interval '1 day')::date loop
    for v_wh in
      select * from work_hours where company_id = v_company and weekday = extract(dow from v_day)
    loop
      v_lunch := case when random() < 0.5 then '12:00' else '13:00' end;
      insert into time_blocks (company_id, professional_id, kind, reason, starts_at, ends_at)
      values (v_company, v_wh.professional_id, 'almoco', 'Almoço',
        (v_day + v_lunch) at time zone v_tz, (v_day + v_lunch + interval '1 hour') at time zone v_tz);

      v_cursor := v_wh.start_time;
      while v_cursor < v_wh.end_time loop
        if v_cursor >= v_lunch and v_cursor < v_lunch + interval '1 hour' then
          v_cursor := v_lunch + interval '1 hour';
          continue;
        end if;

        select s.* into v_service from services s
        join professional_services ps on ps.service_id = s.id
        where ps.professional_id = v_wh.professional_id
        order by random() limit 1;

        if v_cursor + make_interval(mins => v_service.duration_min) <= v_wh.end_time
          and not (v_cursor < v_lunch + interval '1 hour' and v_cursor + make_interval(mins => v_service.duration_min) > v_lunch)
          and random() < 0.65
        then
          v_start := (v_day + v_cursor) at time zone v_tz;
          select id into v_customer from customers where company_id = v_company order by random() limit 1;
          v_status := case
            when v_start + make_interval(mins => v_service.duration_min) < now() then
              (array['concluido','concluido','concluido','concluido','concluido','concluido','faltou','cancelado'])[1 + floor(random() * 8)::int]::appointment_status
            when v_start < now() then 'em_atendimento'
            else (array['agendado','agendado','confirmado'])[1 + floor(random() * 3)::int]::appointment_status
          end;
          v_channel := (array['whatsapp','whatsapp','whatsapp','instagram','site','presencial','telefone'])[1 + floor(random() * 7)::int]::booking_channel;

          insert into appointments (company_id, unit_id, professional_id, service_id, customer_id,
            starts_at, ends_at, status, channel, price_cents)
          values (v_company, '00000000-0000-0000-0000-00000000d001', v_wh.professional_id, v_service.id, v_customer,
            v_start, v_start + make_interval(mins => v_service.duration_min), v_status, v_channel, v_service.price_cents);

          v_cursor := v_cursor + make_interval(mins => v_service.duration_min);
        else
          v_cursor := v_cursor + interval '30 minutes';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Pagamentos dos atendimentos concluídos.
insert into payments (company_id, appointment_id, customer_id, professional_id, method, amount_cents, commission_cents, paid_at)
select a.company_id, a.id, a.customer_id, a.professional_id,
  (array['pix','pix','pix','cartao_credito','cartao_debito','dinheiro'])[1 + floor(random() * 6)::int]::payment_method,
  a.price_cents, round(a.price_cents * p.commission_pct / 100), a.ends_at
from appointments a join professionals p on p.id = a.professional_id
where a.status = 'concluido';

insert into quick_replies (company_id, title, body) values
  ('00000000-0000-0000-0000-00000000c001', 'Endereço', 'Estamos na Rua das Palmeiras, 240, Pinheiros, São Paulo. Qualquer dúvida é só chamar!'),
  ('00000000-0000-0000-0000-00000000c001', 'Confirmar agendamento', 'Seu horário está confirmado para {data} às {hora}.'),
  ('00000000-0000-0000-0000-00000000c001', 'Enviar horários disponíveis', 'Tenho estes horários livres: {horarios}. Qual prefere?');

-- Conversas de exemplo.
with c as (
  insert into conversations (company_id, customer_id, channel, status, tags, unread_count, last_message_at)
  select '00000000-0000-0000-0000-00000000c001', cu.id, ch::conversation_channel, 'aberta', '{}', unread, now() - make_interval(mins => ago)
  from (values ('Beatriz Santos', 'whatsapp', 2, 25), ('Gabriel Martins', 'instagram', 1, 18),
               ('Larissa Gomes', 'site', 0, 60), ('Lucas Pereira', 'whatsapp', 3, 7)) as v (name, ch, unread, ago)
  join customers cu on cu.name = v.name
  returning id, customer_id, last_message_at
)
insert into messages (company_id, conversation_id, direction, body, created_at)
select '00000000-0000-0000-0000-00000000c001', c.id, 'entrada', m.body, c.last_message_at
from c join customers cu on cu.id = c.customer_id
join (values ('Beatriz Santos', 'Consigo remarcar para sábado?'), ('Gabriel Martins', 'Olá, quanto custa corte + barba?'),
             ('Larissa Gomes', 'Vocês fazem coloração sem amônia?'), ('Lucas Pereira', 'Tem horário hoje com o Rafael?')) as m (name, body)
  on m.name = cu.name;
