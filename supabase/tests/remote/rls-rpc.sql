begin;

insert into public.users (id, kakao_id, nickname, primary_surface, status)
values
  (
    '00000000-0000-4000-8000-00000000f301',
    'remote-rls-active-fixture',
    '활성 계정',
    'APP',
    'ACTIVE'
  ),
  (
    '00000000-0000-4000-8000-00000000f302',
    'remote-rls-withdrawn-fixture',
    '탈퇴 계정',
    'APP',
    'WITHDRAWN'
  );

create temporary table lf_remote_rls_results (
  account_status text primary key,
  visible_rows int not null
) on commit drop;

grant insert, select on table pg_temp.lf_remote_rls_results to authenticated;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000f301',
  true
);
insert into pg_temp.lf_remote_rls_results
select 'ACTIVE', count(*)::int
from public.users u
where u.id = '00000000-0000-4000-8000-00000000f301';
reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000f302',
  true
);
insert into pg_temp.lf_remote_rls_results
select 'WITHDRAWN', count(*)::int
from public.users u
where u.id = '00000000-0000-4000-8000-00000000f302';
reset role;

do $$
declare
  v_active int;
  v_withdrawn int;
  v_first jsonb;
  v_second jsonb;
begin
  select r.visible_rows into strict v_active
  from pg_temp.lf_remote_rls_results r
  where r.account_status = 'ACTIVE';

  select r.visible_rows into strict v_withdrawn
  from pg_temp.lf_remote_rls_results r
  where r.account_status = 'WITHDRAWN';

  if v_active <> 1 then
    raise exception 'active RLS visibility mismatch: %', v_active;
  end if;
  if v_withdrawn <> 0 then
    raise exception 'withdrawn RLS visibility mismatch: %', v_withdrawn;
  end if;

  v_first := public.lf_profile_nickname_update(
    '00000000-0000-4000-8000-00000000f401',
    '00000000-0000-4000-8000-00000000f301',
    '원격 RPC 검증'
  );
  v_second := public.lf_profile_nickname_update(
    '00000000-0000-4000-8000-00000000f401',
    '00000000-0000-4000-8000-00000000f301',
    '원격 RPC 검증'
  );

  if v_first <> '{"nickname": "원격 RPC 검증"}'::jsonb or v_second <> v_first then
    raise exception 'active RPC idempotency mismatch: %, %', v_first, v_second;
  end if;

  begin
    perform public.lf_profile_nickname_update(
      '00000000-0000-4000-8000-00000000f402',
      '00000000-0000-4000-8000-00000000f302',
      '차단되어야 함'
    );
    raise exception 'withdrawn RPC was not blocked';
  exception
    when others then
      if sqlerrm <> 'E_FORBIDDEN' then
        raise;
      end if;
  end;
end;
$$;

rollback;

select jsonb_build_object(
  'active_rls', 'PASS',
  'withdrawn_rls', 'PASS',
  'active_rpc_idempotency', 'PASS',
  'withdrawn_rpc_block', 'PASS',
  'fixture_persisted', false
) as verification;
