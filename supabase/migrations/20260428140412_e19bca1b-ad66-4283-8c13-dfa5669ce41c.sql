create or replace function public.webhooks_increment_counter(p_endpoint_id uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field = 'total_sucesso' then
    update public.webhooks_endpoints set total_sucesso = total_sucesso + 1 where id = p_endpoint_id;
  elsif p_field = 'total_falha' then
    update public.webhooks_endpoints set total_falha = total_falha + 1 where id = p_endpoint_id;
  end if;
end;
$$;

-- Cron a cada minuto, chamando a edge function via pg_net
do $$
declare
  v_url text := 'https://cpvdncsxzostovdduhci.supabase.co/functions/v1/webhooks-dispatcher?action=run';
  v_anon text;
begin
  -- remove jobs anteriores com mesmo nome
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'webhooks-dispatcher-tick';

  perform cron.schedule(
    'webhooks-dispatcher-tick',
    '* * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
    $cmd$, v_url)
  );
end$$;