-- 같은 이름의 pg_cron 교체를 한 트랜잭션씩 실행해 동시 호출의 중복 등록을 막는다.

create or replace function public.lf_schedule_notification_retention()
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-notification-retention-scheduler', 0)
  );

  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'lf-notification-retention'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'lf-notification-retention',
    '20 19 * * *',
    'select public.lf_notification_retention_purge();'
  );
end;
$$;

revoke all on function public.lf_schedule_notification_retention()
  from public, anon, authenticated;
grant execute on function public.lf_schedule_notification_retention() to service_role;

select public.lf_schedule_notification_retention();
