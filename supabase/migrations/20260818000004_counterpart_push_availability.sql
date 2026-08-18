-- EC-G01: 상대가 앱 푸시를 받을 수 없을 때 작성자가 직접 알릴 수 있어야 한다.
-- 기존 상세 함수는 내용 snapshot 전용으로 보존하고 같은 이름의 공개 wrapper에서 전달 가능성만 덧붙인다.

alter function public.lf_promise_detail(uuid, uuid)
  rename to lf_promise_detail_core;

revoke all on function public.lf_promise_detail_core(uuid, uuid)
  from public, anon, authenticated, service_role;

create function public.lf_promise_detail(
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_detail jsonb;
  v_actor_role public.participant_role;
  v_counterpart uuid;
  v_push_available boolean := false;
begin
  -- core가 존재 은닉·숨김·참여 권한을 먼저 검사한다.
  v_detail := public.lf_promise_detail_core(p_actor, p_promise_id);
  v_actor_role := (v_detail ->> 'my_role')::public.participant_role;

  if v_actor_role = 'CREATOR' then
    select pp.user_id
      into v_counterpart
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.role = 'PARTNER'
       and pp.status = 'JOINED'
     order by pp.id
     limit 1;
  elsif v_actor_role = 'PARTNER' then
    select pp.user_id
      into v_counterpart
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.role = 'CREATOR'
       and pp.status = 'JOINED'
     order by pp.id
     limit 1;
  end if;

  if v_counterpart is not null then
    select exists (
      select 1
        from public.device_tokens dt
       where dt.user_id = v_counterpart
    ) into v_push_available;
  end if;

  return v_detail || jsonb_build_object(
    'counterpart_push_available', v_push_available
  );
end;
$$;

revoke all on function public.lf_promise_detail(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_promise_detail(uuid, uuid)
  to service_role;

comment on function public.lf_promise_detail(uuid, uuid) is
  'SCR-A05 participant-only snapshot with counterpart push availability for EC-G01.';

