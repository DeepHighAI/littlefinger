-- ADR 0015 내부 테스트 스모크 — 읽기 전용. 실행 방법은 docs/setup/monetization-retention-release.md §6.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/remote/adr0015-smoke.sql
--
-- 앞의 select 는 metadata.sql 과 같은 모양의 JSON 보고서다(기록용). 뒤의 do 블록이 단언이며,
-- 하나라도 어긋나면 raise exception 으로 psql 이 0 이 아닌 코드로 끝난다.
-- Edge Function 자체는 Postgres 에 없다 — 다섯 함수의 존재는 `supabase functions list` 로 보고,
-- 여기서는 그 다섯이 부르는 RPC 가 service_role 전용인지를 본다.

select jsonb_build_object(
  'retention_cron', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active
    )), '[]'::jsonb)
    from cron.job j
    where j.jobname = 'lf-retention-maintenance'
  ),
  'new_edge_rpc_acl', (
    select jsonb_agg(jsonb_build_object(
      'function', p.proname,
      'public', pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'),
      'anon', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'security_definer', p.prosecdef
    ) order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'lf_promise_entitlements', 'lf_reward_intent_create', 'lf_reward_status',
        'lf_reward_grant', 'lf_retention_maintenance', 'lf_purge_job_claim',
        'lf_purge_job_finalize'
      )
  ),
  'new_tables_rls', (
    select jsonb_object_agg(c.relname, c.relrowsecurity)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'reward_intents', 'promise_reward_grants', 'promise_purge_jobs',
        'user_keep_rate_aggregates', 'promise_duration_baselines',
        'promise_access_graces', 'purged_promise_receipts'
      )
  ),
  'app_configs', (
    select jsonb_object_agg(ac.key, ac.value)
    from public.app_configs ac
    where ac.key in ('rewarded_ads_enabled', 'ads_enabled', 'min_app_version')
  ),
  'legal_versions', jsonb_build_object(
    'terms', public.lf_current_terms_version(),
    'privacy', public.lf_current_privacy_version()
  ),
  'stale_evidence_purge_after', (
    select count(*)::int
    from public.fulfillment_evidences fe
    where fe.purge_after is not null and fe.removed_at is null and fe.purged_at is null
  ),
  'evidence_retention_trigger_count', (
    select count(*)::int
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'promises'
      and t.tgname = 'fulfillment_evidence_retention'
  )
) as verification;

do $smoke$
declare
  v_count int;
  v_name text;
  v_rpc record;
  v_expected_rpc text[] := array[
    'lf_promise_entitlements', 'lf_reward_intent_create', 'lf_reward_status',
    'lf_reward_grant', 'lf_retention_maintenance', 'lf_purge_job_claim',
    'lf_purge_job_finalize'
  ];
  v_expected_tables text[] := array[
    'reward_intents', 'promise_reward_grants', 'promise_purge_jobs',
    'user_keep_rate_aggregates', 'promise_duration_baselines',
    'promise_access_graces', 'purged_promise_receipts'
  ];
  v_rls boolean;
  v_value jsonb;
  v_text text;
begin
  -- 1. 보존 워커 cron 은 정확히 한 줄, 활성, 매시 17분.
  select count(*) into v_count from cron.job where jobname = 'lf-retention-maintenance';
  if v_count <> 1 then
    raise exception 'cron lf-retention-maintenance: % rows, expected 1', v_count;
  end if;
  select count(*) into v_count
    from cron.job
   where jobname = 'lf-retention-maintenance' and active and schedule = '17 * * * *';
  if v_count <> 1 then
    raise exception 'cron lf-retention-maintenance must be active on ''17 * * * *''';
  end if;

  -- 2. 새 Edge Function 다섯 개가 부르는 RPC: 존재하고, service_role 만 실행할 수 있다.
  foreach v_name in array v_expected_rpc loop
    select count(*) into v_count
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;
    if v_count = 0 then
      raise exception 'rpc public.% is missing', v_name;
    end if;
    for v_rpc in
      select p.oid, p.proname
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name
    loop
      if pg_catalog.has_function_privilege('public', v_rpc.oid, 'EXECUTE')
         or pg_catalog.has_function_privilege('anon', v_rpc.oid, 'EXECUTE')
         or pg_catalog.has_function_privilege('authenticated', v_rpc.oid, 'EXECUTE') then
        raise exception 'rpc public.% is executable by a client role', v_rpc.proname;
      end if;
      if not pg_catalog.has_function_privilege('service_role', v_rpc.oid, 'EXECUTE') then
        raise exception 'rpc public.% is not executable by service_role', v_rpc.proname;
      end if;
    end loop;
  end loop;

  -- 3. 새 서버 전용 테이블은 모두 RLS 가 켜져 있다.
  foreach v_name in array v_expected_tables loop
    select c.relrowsecurity into v_rls
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = v_name and c.relkind in ('r', 'p');
    if v_rls is null then
      raise exception 'table public.% is missing', v_name;
    end if;
    if not v_rls then
      raise exception 'table public.% has RLS disabled', v_name;
    end if;
  end loop;

  -- 4. app_configs: 최소 버전은 "0.2.0", 보상형 플래그는 boolean.
  select value into v_value from public.app_configs where key = 'min_app_version';
  if v_value is distinct from '"0.2.0"'::jsonb then
    raise exception 'app_configs.min_app_version = %, expected "0.2.0"', v_value;
  end if;
  select value into v_value from public.app_configs where key = 'rewarded_ads_enabled';
  if v_value is null or jsonb_typeof(v_value) <> 'boolean' then
    raise exception 'app_configs.rewarded_ads_enabled = %, expected a boolean', v_value;
  end if;
  select value into v_value from public.app_configs where key = 'ads_enabled';
  if v_value is null or jsonb_typeof(v_value) <> 'boolean' then
    raise exception 'app_configs.ads_enabled = %, expected a boolean', v_value;
  end if;

  -- 5. 법무 문서 버전은 둘 다 2026-08-30.1.
  v_text := public.lf_current_terms_version();
  if v_text is distinct from '2026-08-30.1' then
    raise exception 'lf_current_terms_version() = %, expected 2026-08-30.1', v_text;
  end if;
  v_text := public.lf_current_privacy_version();
  if v_text is distinct from '2026-08-30.1' then
    raise exception 'lf_current_privacy_version() = %, expected 2026-08-30.1', v_text;
  end if;

  -- 6. 폐지된 J-08 기한이 살아 있는 증빙 행에 남아 있지 않다.
  select count(*) into v_count
    from public.fulfillment_evidences fe
   where fe.purge_after is not null and fe.removed_at is null and fe.purged_at is null;
  if v_count <> 0 then
    raise exception '% live fulfillment_evidences rows still carry purge_after', v_count;
  end if;

  -- 7. 기한을 매기던 트리거와 그 함수는 없다.
  select count(*) into v_count
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'promises'
     and t.tgname = 'fulfillment_evidence_retention';
  if v_count <> 0 then
    raise exception 'trigger fulfillment_evidence_retention still exists on public.promises';
  end if;
  if pg_catalog.to_regproc('public.lf_set_terminal_evidence_retention') is not null then
    raise exception 'function public.lf_set_terminal_evidence_retention still exists';
  end if;

  raise notice 'ADR 0015 smoke: all assertions passed';
end
$smoke$;
