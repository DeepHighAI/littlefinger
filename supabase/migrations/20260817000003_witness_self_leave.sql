-- EC-D03: 증인 나가기는 역할만 철회하고 기존 확인 서명과 참가 이력을 보존한다.

create or replace function public.lf_witness_leave(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_promise public.promises%rowtype;
  v_participant public.promise_participants%rowtype;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-leave');
  if v_cached is not null then
    return v_cached;
  end if;

  select * into v_promise
    from public.promises
   where id = p_promise_id
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select * into v_participant
    from public.promise_participants
   where promise_id = p_promise_id
     and user_id = p_actor
     and role = 'WITNESS'
     and status in ('JOINED', 'WITHDRAWN')
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  update public.promise_participants
     set status = 'WITHDRAWN'
   where id = v_participant.id
     and status = 'JOINED';

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'status', 'WITHDRAWN'
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_witness_leave(uuid, uuid, uuid) is
  '증인 역할을 영구 철회하되 WITNESS_SIGN 승인 기록은 보존한다(EC-D03).';

revoke all on function public.lf_witness_leave(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_witness_leave(uuid, uuid, uuid)
  to service_role;
