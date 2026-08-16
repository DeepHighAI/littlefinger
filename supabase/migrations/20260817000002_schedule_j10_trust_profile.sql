-- J-10 신뢰 프로필 정합성 보정을 매일 03:00 KST에 한 번 실행한다.

create or replace function public.lf_schedule_trust_profile_recompute()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j10-trust-profile-scheduler', 0)
  );

  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;

  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'lf-j10-trust-profile-recompute'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'lf-j10-trust-profile-recompute',
    '0 18 * * *',
    'select public.lf_recompute_all_trust_profiles();'
  );
end;
$$;

revoke all on function public.lf_schedule_trust_profile_recompute()
  from public, anon, authenticated;
grant execute on function public.lf_schedule_trust_profile_recompute()
  to service_role;

select public.lf_schedule_trust_profile_recompute();
