-- F-06: outbox INSERT는 즉시 worker를 깨우고, 10분 cron은 누락·lease 만료를 회복한다.

create or replace function public.lf_nudge_push_send()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'push_send_url'
         limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-send-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'push_send_secret'
           limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  exception when others then
    -- nudge는 지연을 줄일 뿐, outbox 원자성과 10분 복구를 방해하면 안 된다.
    null;
  end;

  return new;
end;
$$;

create trigger notification_outbox_nudge_push_send
after insert on public.notification_outbox
for each row execute function public.lf_nudge_push_send();

create or replace function public.lf_schedule_push_send()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;

  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'lf-push-send'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'lf-push-send',
    '*/10 * * * *',
    $command$
      select net.http_post(
        url := (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'push_send_url'
           limit 1
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-send-secret', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'push_send_secret'
             limit 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $command$
  );
end;
$$;

revoke all on function public.lf_nudge_push_send() from public, anon, authenticated, service_role;
revoke all on function public.lf_schedule_push_send() from public, anon, authenticated;
grant execute on function public.lf_schedule_push_send() to service_role;

select public.lf_schedule_push_send();
