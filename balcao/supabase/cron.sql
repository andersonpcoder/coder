-- Agendamentos do pg_cron. Rode no SQL Editor depois de publicar as funções,
-- trocando SEU_PROJECT_REF e CRON_SECRET. Requer as extensões pg_cron e pg_net.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Lembretes, aniversários e retornos pendentes: a cada 5 minutos.
select cron.schedule('balcao-enviar-mensagens', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
$$);

-- Gera as mensagens de aniversário e retorno do dia: 8h de Brasília (11h UTC).
select cron.schedule('balcao-aniversario-retorno', '0 11 * * *', $$
  select public.enqueue_marketing_messages();
$$);

-- Opcional: marca como "faltou" quem não fez check-in até 2h depois do horário.
-- Ative só se a recepção sempre registra o check-in ou a conclusão no Balcão.
-- select cron.schedule('balcao-faltas', '*/30 * * * *', $$
--   update public.appointments set status = 'faltou'
--   where status in ('agendado', 'confirmado') and ends_at < now() - interval '2 hours';
-- $$);
