-- 신뢰 프로필 재계산 직렬화.
--
-- 서로 다른 약속이 같은 사용자의 종결을 동시에 커밋하면 각 트랜잭션의 스냅샷은 상대의
-- 미커밋 상태를 보지 못한다. 집계 뒤 upsert만 직렬화하면 낮은 집계가 마지막에 덮어쓸 수
-- 있으므로, 사용자별 transaction advisory lock을 집계보다 먼저 잡는다.

create or replace function public.lf_recompute_trust_profile(p_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_completed  int;
  v_broken     int;
  v_disputed   int;
  v_unresolved int;
  v_active     int;
  v_keep_rate  int;
  v_response   jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_trust_profile:' || p_user_id::text, 0)
  );

  select count(*) filter (
           where p.status = 'COMPLETED'
             and (
               (pp.role = 'CREATOR' and p.keeper in ('CREATOR', 'BOTH'))
               or (pp.role = 'PARTNER' and p.keeper in ('PARTNER', 'BOTH'))
             )
         )::int,
         count(*) filter (
           where p.status = 'BROKEN'
             and (
               (pp.role = 'CREATOR' and p.keeper in ('CREATOR', 'BOTH'))
               or (pp.role = 'PARTNER' and p.keeper in ('PARTNER', 'BOTH'))
             )
         )::int,
         count(*) filter (where p.status = 'DISPUTED')::int,
         count(*) filter (where p.status = 'UNRESOLVED')::int,
         count(*) filter (where p.status in ('ACTIVE', 'AMEND_PENDING', 'CHECKING'))::int
    into v_completed, v_broken, v_disputed, v_unresolved, v_active
    from public.promise_participants pp
    join public.promises p on p.id = pp.promise_id
   where pp.user_id = p_user_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if v_completed + v_broken < public.lf_trust_min_sample() then
    v_keep_rate := null;
  else
    v_keep_rate := round(v_completed * 100.0 / (v_completed + v_broken))::int;
  end if;

  insert into public.trust_profiles (
    user_id, completed_count, broken_count, disputed_count, unresolved_count,
    active_count, keep_rate, updated_at
  )
  values (
    p_user_id, v_completed, v_broken, v_disputed, v_unresolved,
    v_active, v_keep_rate, now()
  )
  on conflict (user_id) do update
    set completed_count = excluded.completed_count,
        broken_count = excluded.broken_count,
        disputed_count = excluded.disputed_count,
        unresolved_count = excluded.unresolved_count,
        active_count = excluded.active_count,
        keep_rate = excluded.keep_rate,
        updated_at = now()
  returning to_jsonb(trust_profiles) into v_response;

  return v_response;
end;
$$;

comment on function public.lf_recompute_trust_profile is
  'F-09 지킴율 캐시 재계산. 사용자별 transaction advisory lock 뒤 keeper와 별도 종결 건수를 집계한다.';
