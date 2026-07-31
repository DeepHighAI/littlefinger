-- NT-19를 추가 조회 없이 만들 수 있도록 재확인 응답에 현재 약속 제목을 포함한다.

create or replace function public.lf_fulfillment_reopen(
  p_idempotency_key uuid,
  p_actor          uuid,
  p_promise_id     uuid,
  p_surface        public.surface
)
returns jsonb
language plpgsql
as $$
declare
  v_cached          jsonb;
  v_promise         public.promises%rowtype;
  v_actor_role      public.participant_role;
  v_now             timestamptz := now();
  v_round_no        int;
  v_deadline        timestamptz;
  v_response        jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'fulfillment-reopen'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select pp.role
    into v_actor_role
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_promise.status <> 'DISPUTED' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  v_round_no := v_promise.check_round_no + 1;
  v_deadline := v_now + interval '7 days';

  update public.promises
     set status = 'CHECKING',
         check_round_no = v_round_no,
         check_deadline_at = v_deadline,
         closed_at = null,
         lock_version = lock_version + 1,
         updated_at = v_now
   where id = p_promise_id
     and status = 'DISPUTED';

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = p_promise_id
     and kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
     and status = 'PENDING';

  insert into public.reminder_schedules (
    promise_id, user_id, kind, fire_at, check_round_no
  )
  select p_promise_id,
         pp.user_id,
         schedule.kind::public.reminder_kind,
         schedule.fire_at,
         v_round_no
    from public.promise_participants pp
    cross join lateral (
      values
        (
          'CHECK_R1',
          ((((v_now at time zone 'Asia/Seoul')::date + 2) + time '09:00')
            at time zone 'Asia/Seoul')
        ),
        (
          'CHECK_R2',
          ((((v_now at time zone 'Asia/Seoul')::date + 5) + time '09:00')
            at time zone 'Asia/Seoul')
        )
    ) as schedule(kind, fire_at)
   where pp.promise_id = p_promise_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
     and pp.user_id is not null
  on conflict (promise_id, user_id, kind, check_round_no)
    where kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
      and check_round_no is not null
  do nothing;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'status', 'CHECKING',
           'round_no', v_round_no,
           'check_deadline_at', v_deadline,
           'title', v_promise.title,
           'notification_recipients', coalesce(
             jsonb_agg(
               jsonb_build_object('user_id', pp.user_id, 'role', pp.role)
               order by pp.id
             ) filter (where pp.user_id is not null),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.role <> v_actor_role
     and pp.status = 'JOINED';

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_fulfillment_reopen is
  'DISPUTED 약속을 새 7일 CHECKING 라운드로 열고 NT-19용 현재 제목을 반환한다.';

revoke all on function public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)
  from public, anon, authenticated;
grant execute on function public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)
  to service_role;
