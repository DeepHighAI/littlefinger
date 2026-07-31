-- NT-09 제목을 추가 조회 없이 만들 수 있도록 제출자 닉네임을 응답에 포함한다.

create or replace function public.lf_fulfillment_submit(
  p_idempotency_key uuid,
  p_actor          uuid,
  p_promise_id     uuid,
  p_answer         public.fulfillment_answer,
  p_comment        text,
  p_revise         boolean,
  p_surface        public.surface
)
returns jsonb
language plpgsql
as $$
declare
  c_comment_max constant int := 200;
  v_cached           jsonb;
  v_promise          public.promises%rowtype;
  v_actor_role       public.participant_role;
  v_actor_nickname   text;
  v_actor_check_id   uuid;
  v_actor_submitted  timestamptz;
  v_actor_revised    timestamptz;
  v_other_check_id   uuid;
  v_other_answer     public.fulfillment_answer;
  v_comment          text := nullif(public.lf_normalize_input(p_comment), '');
  v_result           public.promise_status := 'CHECKING';
  v_response         jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'fulfillment-submit'
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

  select pp.role, u.nickname
    into v_actor_role, v_actor_nickname
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_promise.status <> 'CHECKING'
     or v_promise.check_deadline_at is null
     or v_promise.check_deadline_at <= now() then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if char_length(coalesce(v_comment, '')) > c_comment_max then
    raise exception 'E_VALIDATION';
  end if;

  select fc.id, fc.submitted_at, fc.revised_at
    into v_actor_check_id, v_actor_submitted, v_actor_revised
    from public.fulfillment_checks fc
   where fc.promise_id = p_promise_id
     and fc.user_id = p_actor
     and fc.round_no = v_promise.check_round_no;

  select fc.id, fc.answer
    into v_other_check_id, v_other_answer
    from public.fulfillment_checks fc
    join public.promise_participants pp
      on pp.promise_id = fc.promise_id
     and pp.user_id = fc.user_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where fc.promise_id = p_promise_id
     and fc.user_id <> p_actor
     and fc.round_no = v_promise.check_round_no;

  if v_actor_check_id is null then
    if coalesce(p_revise, false) then
      raise exception 'E_STATE_CONFLICT';
    end if;

    insert into public.fulfillment_checks (
      promise_id, version_id, user_id, round_no, answer, comment, surface
    )
    values (
      p_promise_id, v_promise.current_version_id, p_actor, v_promise.check_round_no,
      p_answer, v_comment, p_surface
    )
    returning id, submitted_at, revised_at
      into v_actor_check_id, v_actor_submitted, v_actor_revised;
  else
    if not coalesce(p_revise, false)
       or v_actor_revised is not null
       or v_other_check_id is not null then
      raise exception 'E_STATE_CONFLICT';
    end if;

    update public.fulfillment_checks
       set answer = p_answer,
           comment = v_comment,
           surface = p_surface,
           revised_at = now()
     where id = v_actor_check_id
       and revised_at is null
    returning submitted_at, revised_at
      into v_actor_submitted, v_actor_revised;

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;
  end if;

  if v_other_check_id is not null then
    if p_answer = 'KEPT' and v_other_answer = 'KEPT' then
      v_result := 'COMPLETED';
    elsif p_answer = 'NOT_KEPT' and v_other_answer = 'NOT_KEPT' then
      v_result := 'BROKEN';
    else
      v_result := 'DISPUTED';
    end if;

    update public.promises
       set status = v_result,
           closed_at = case when v_result in ('COMPLETED', 'BROKEN') then now() else null end,
           lock_version = lock_version + 1,
           updated_at = now()
     where id = p_promise_id
       and status = 'CHECKING';

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;

    if v_result in ('COMPLETED', 'BROKEN') then
      update public.reminder_schedules
         set status = 'CANCELED'
       where promise_id = p_promise_id
         and status = 'PENDING';
    end if;

    perform public.lf_recompute_promise_trust_profiles(p_promise_id);

    if v_result = 'COMPLETED' then
      insert into public.daily_metrics (date, completed_count)
      values ((now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (date) do update
        set completed_count = public.daily_metrics.completed_count + 1,
            updated_at = now();
    end if;
  end if;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'status', v_result,
           'round_no', v_promise.check_round_no,
           'submitted_at', v_actor_submitted,
           'revised_at', v_actor_revised,
           'waiting_for_partner', v_other_check_id is null,
           'title', v_promise.title,
           'actor_nickname', v_actor_nickname,
           'notification_recipients', coalesce(
             jsonb_agg(
               jsonb_build_object('user_id', pp.user_id, 'role', pp.role)
               order by case pp.role when 'CREATOR' then 1 when 'PARTNER' then 2 else 3 end,
                        pp.id
             ) filter (where pp.user_id is not null),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.status = 'JOINED';

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_fulfillment_submit is
  'F-07 제출·정정·판정. NT-09용 제출자 닉네임과 알림 수신자 목록을 반환한다.';

revoke all on function public.lf_fulfillment_submit(
  uuid, uuid, uuid, public.fulfillment_answer, text, boolean, public.surface
) from public, anon, authenticated;
grant execute on function public.lf_fulfillment_submit(
  uuid, uuid, uuid, public.fulfillment_answer, text, boolean, public.surface
) to service_role;
