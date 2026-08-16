-- J-09 기록 무결성 검증을 일요일 05:30 KST에 한 번 실행한다.

create or replace function public.lf_schedule_promise_integrity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j09-integrity-scheduler', 0)
  );

  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;

  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'littlefinger-j09-integrity'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'littlefinger-j09-integrity',
    '30 20 * * 6',
    'select public.lf_verify_promise_integrity();'
  );
end;
$$;

revoke all on function public.lf_schedule_promise_integrity()
  from public, anon, authenticated;
grant execute on function public.lf_schedule_promise_integrity()
  to service_role;

select public.lf_schedule_promise_integrity();
