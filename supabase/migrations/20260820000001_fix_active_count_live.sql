-- E2E Run 1 (2026-08-19) finding F6 fix.
--
-- 탈퇴 경고의 "진행 중인 약속 n건"이 trust_profiles.active_count 스냅숏을 읽는데, 이 스냅숏은
-- 종결 이벤트(이행 확인·배치·J-10)에서만 재계산된다. 승인 직후(T-03) ACTIVE가 된 약속은 다음
-- 종결까지 보이지 않아 실제 1건인데 경고가 0건으로 떴다. 게다가 §4-1-4의 "진행 중"은
-- PENDING·ACTIVE·AMEND_PENDING·CHECKING 4개 상태인데 스냅숏 정의는 PENDING을 빼고 있었다.
--
-- active_count 는 종결 외 전이(T-01·T-03·T-07·J-02)에서도 변하는 유일한 집계라 스냅숏이
-- 구조적으로 맞을 수 없다 — 조회 시점에 라이브로 센다. 종결 카운트·지킴율은 종결 시점
-- 재계산으로 이미 정확하므로 스냅숏을 유지한다. 스냅숏의 active_count 정의도 §4-1-4와 같게
-- 맞춰 "진행 중"이 코드 전체에서 한 가지 의미가 되게 한다.

create or replace function public.lf_my_trust_profile(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  select pg_catalog.jsonb_build_object(
           'nickname', u.nickname,
           'profile_image_url', u.profile_image_url,
           'keep_rate', tp.keep_rate,
           'completed_count', coalesce(tp.completed_count, 0),
           'broken_count', coalesce(tp.broken_count, 0),
           'disputed_count', coalesce(tp.disputed_count, 0),
           'unresolved_count', coalesce(tp.unresolved_count, 0),
           -- 탈퇴 경고(§4-1-4)가 이 값을 쓴다. 스냅숏은 종결 시점에만 갱신되므로 여기만은
           -- 라이브로 센다.
           'active_count', (
             select count(*)::int
               from public.promise_participants pp
               join public.promises p on p.id = pp.promise_id
              where pp.user_id = u.id
                and pp.role in ('CREATOR', 'PARTNER')
                and pp.status = 'JOINED'
                and p.status in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING')
           ),
           'updated_at', coalesce(tp.updated_at, u.updated_at),
           'reminders', pg_catalog.jsonb_build_object(
             'remind_d7', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d7') = 'boolean'
                 then (u.notification_pref->>'remind_d7')::boolean
               else true
             end,
             'remind_d3', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d3') = 'boolean'
                 then (u.notification_pref->>'remind_d3')::boolean
               else true
             end,
             'remind_d1', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d1') = 'boolean'
                 then (u.notification_pref->>'remind_d1')::boolean
               else true
             end,
             'remind_dday', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_dday') = 'boolean'
                 then (u.notification_pref->>'remind_dday')::boolean
               else true
             end,
             'remind_hour', case
               when u.notification_pref->>'remind_hour' in ('09', '12', '20')
                 then u.notification_pref->>'remind_hour'
               else '09'
             end
           )
         )
    into v_response
    from public.users u
    left join public.trust_profiles tp on tp.user_id = u.id
   where u.id = p_actor;

  return v_response;
end;
$$;

-- create or replace 는 20260731053832 가 alter 로 심은 search_path 설정을 지우므로
-- 같은 값을 정의에 직접 싣는다.
create or replace function public.lf_recompute_trust_profile(p_user_id uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
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
         -- §4-1-4의 "진행 중" 정의와 동일하게 PENDING을 포함한다. 표시 경로는 위의 라이브
         -- 계산을 쓰므로 이 값은 KPI 캐시다.
         count(*) filter (
           where p.status in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING')
         )::int
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

-- create or replace 는 기존 ACL 을 보존하지만, 서버 전용 3중 revoke 는 감사 기준선이라
-- 명시적으로 다시 못박는다.
revoke all on function public.lf_my_trust_profile(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_recompute_trust_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.lf_my_trust_profile(uuid) to service_role;
grant execute on function public.lf_recompute_trust_profile(uuid) to service_role;
