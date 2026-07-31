-- F-07 최종 보강: 응답 원문 비공개, 배치 잠금, 알림 취소, 역할별 제출 사실,
-- 재확인 신뢰 프로필, 원격 정책값을 한 번에 교정한다.

-- ============================================================
-- 원격 정책값
-- ============================================================

insert into public.app_configs (key, value)
values
  ('check_deadline_days', '7'::jsonb),
  ('reminder_send_hour_kst', '9'::jsonb)
on conflict (key) do nothing;

create or replace function public.lf_policy_config_int(p_key text)
returns int
language plpgsql
stable
as $$
declare
  v_value   jsonb;
  v_numeric numeric;
  v_default int;
  v_min     int;
  v_max     int;
begin
  case p_key
    when 'check_deadline_days' then
      v_default := 7;
      v_min := 1;
      v_max := 2147483647;
    when 'reminder_send_hour_kst' then
      v_default := 9;
      v_min := 0;
      v_max := 23;
    else
      return null;
  end case;

  select ac.value
    into v_value
    from public.app_configs ac
   where ac.key = p_key;

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return v_default;
  end if;

  begin
    v_numeric := (v_value #>> '{}')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      return v_default;
  end;

  if v_numeric = trunc(v_numeric)
     and v_numeric between v_min and v_max then
    return v_numeric::int;
  end if;

  return v_default;
end;
$$;

comment on function public.lf_policy_config_int is
  '§11-3 정수 정책값을 app_configs에서 읽고 누락·오염 시 명세 기본값으로 돌아간다.';

create or replace function public.lf_reminder_send_hour_kst()
returns int
language sql
stable
as $$
  select public.lf_policy_config_int('reminder_send_hour_kst');
$$;

revoke all on function public.lf_policy_config_int(text)
  from public, anon, authenticated;
revoke all on function public.lf_reminder_send_hour_kst()
  from public, anon, authenticated;
grant execute on function public.lf_policy_config_int(text) to service_role;
grant execute on function public.lf_reminder_send_hour_kst() to service_role;

-- ============================================================
-- 응답 원문 비공개
-- ============================================================

drop policy if exists "fulfillment checks read participants"
  on public.fulfillment_checks;
revoke select on table public.fulfillment_checks
  from public, anon, authenticated;
grant select on table public.fulfillment_checks to service_role;

-- ============================================================
-- 역할별 제출 사실
-- ============================================================

create or replace function public.lf_promise_fulfillment_detail(
  p_actor      uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_actor_role public.participant_role;
  v_round_no   int;
  v_response   jsonb;
begin
  select pp.role, p.check_round_no
    into v_actor_role, v_round_no
    from public.promises p
    join public.promise_participants pp
      on pp.promise_id = p.id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where p.id = p_promise_id;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select jsonb_build_object(
           'promise_id', p.id,
           'title', p.title,
           'body', p.body,
           'category', p.category,
           'end_date', p.end_date,
           'keeper', p.keeper,
           'reward', p.reward,
           'penalty', p.penalty,
           'status', p.status,
           'checking_started_at', p.checking_started_at,
           'check_deadline_at', p.check_deadline_at,
           'check_round_no', p.check_round_no,
           'creator', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = p.id
                and pp.role = 'CREATOR'
                and pp.status = 'JOINED'
           ),
           'partner', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = p.id
                and pp.role = 'PARTNER'
                and pp.status = 'JOINED'
           ),
           'my_role', v_actor_role,
           'my_check', (
             select jsonb_build_object(
                      'role', pp.role,
                      'answer', fc.answer,
                      'comment', fc.comment,
                      'submitted_at', fc.submitted_at,
                      'revised_at', fc.revised_at,
                      'round_no', fc.round_no
                    )
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
              where fc.promise_id = p.id
                and fc.user_id = p_actor
                and fc.round_no = p.check_round_no
           ),
           'creator_has_submitted', exists (
             select 1
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
                and pp.role = 'CREATOR'
                and pp.status = 'JOINED'
              where fc.promise_id = p.id
                and fc.round_no = p.check_round_no
           ),
           'partner_has_submitted', exists (
             select 1
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
                and pp.role = 'PARTNER'
                and pp.status = 'JOINED'
              where fc.promise_id = p.id
                and fc.round_no = p.check_round_no
           ),
           -- 상대 응답 내용은 호출자도 현재 라운드에 제출한 뒤에만 공개한다.
           'partner_check', case
             when exists (
               select 1
                 from public.fulfillment_checks mine
                where mine.promise_id = p.id
                  and mine.user_id = p_actor
                  and mine.round_no = p.check_round_no
             )
             then (
               select jsonb_build_object(
                        'role', pp.role,
                        'answer', fc.answer,
                        'comment', fc.comment,
                        'submitted_at', fc.submitted_at,
                        'revised_at', fc.revised_at,
                        'round_no', fc.round_no
                      )
                 from public.fulfillment_checks fc
                 join public.promise_participants pp
                   on pp.promise_id = fc.promise_id
                  and pp.user_id = fc.user_id
                  and pp.role in ('CREATOR', 'PARTNER')
                  and pp.status = 'JOINED'
                where fc.promise_id = p.id
                  and fc.user_id <> p_actor
                  and fc.round_no = p.check_round_no
             )
             else null
           end,
           'history', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'round_no', rounds.round_no,
                          'creator_check', (
                            select jsonb_build_object(
                                     'role', 'CREATOR',
                                     'answer', fc.answer,
                                     'comment', fc.comment,
                                     'submitted_at', fc.submitted_at,
                                     'revised_at', fc.revised_at,
                                     'round_no', fc.round_no
                                   )
                              from public.fulfillment_checks fc
                              join public.promise_participants pp
                                on pp.promise_id = fc.promise_id
                               and pp.user_id = fc.user_id
                               and pp.role = 'CREATOR'
                             where fc.promise_id = p.id
                               and fc.round_no = rounds.round_no
                          ),
                          'partner_check', (
                            select jsonb_build_object(
                                     'role', 'PARTNER',
                                     'answer', fc.answer,
                                     'comment', fc.comment,
                                     'submitted_at', fc.submitted_at,
                                     'revised_at', fc.revised_at,
                                     'round_no', fc.round_no
                                   )
                              from public.fulfillment_checks fc
                              join public.promise_participants pp
                                on pp.promise_id = fc.promise_id
                               and pp.user_id = fc.user_id
                               and pp.role = 'PARTNER'
                             where fc.promise_id = p.id
                               and fc.round_no = rounds.round_no
                          )
                        )
                        order by rounds.round_no
                      )
                 from (
                   select distinct fc.round_no
                     from public.fulfillment_checks fc
                    where fc.promise_id = p.id
                      and fc.round_no < p.check_round_no
                 ) rounds
             ),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promises p
   where p.id = p_promise_id;

  return v_response;
end;
$$;

comment on function public.lf_promise_fulfillment_detail is
  'JOINED 당사자 상세. 역할별 제출 사실은 공개하되 미제출 호출자에게 상대 답변·의견은 숨긴다.';

revoke all on function public.lf_promise_fulfillment_detail(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_promise_fulfillment_detail(uuid, uuid)
  to service_role;

-- ============================================================
-- 성공한 제출의 현재 라운드 확인 알림 취소
-- ============================================================

create or replace function public.lf_cancel_actor_check_reminders()
returns trigger
language plpgsql
as $$
begin
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = new.promise_id
     and user_id = new.user_id
     and check_round_no = new.round_no
     and kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
     and status = 'PENDING';
  return new;
end;
$$;

drop trigger if exists fulfillment_check_cancel_actor_reminders
  on public.fulfillment_checks;
create trigger fulfillment_check_cancel_actor_reminders
after insert or update on public.fulfillment_checks
for each row execute function public.lf_cancel_actor_check_reminders();

create or replace function public.lf_cancel_terminal_check_reminders()
returns trigger
language plpgsql
as $$
begin
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = new.id
     and check_round_no = new.check_round_no
     and kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
     and status = 'PENDING';
  return new;
end;
$$;

drop trigger if exists promise_terminal_cancel_check_reminders
  on public.promises;
create trigger promise_terminal_cancel_check_reminders
after update of status on public.promises
for each row
when (
  old.status = 'CHECKING'
  and new.status in ('COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED')
)
execute function public.lf_cancel_terminal_check_reminders();

revoke all on function public.lf_cancel_actor_check_reminders()
  from public, anon, authenticated;
revoke all on function public.lf_cancel_terminal_check_reminders()
  from public, anon, authenticated;
grant execute on function public.lf_cancel_actor_check_reminders() to service_role;
grant execute on function public.lf_cancel_terminal_check_reminders() to service_role;

-- ============================================================
-- J-02 — 잠긴 대상도 건너뛰지 않고 같은 실행에서 처리한다
-- ============================================================

create or replace function public.lf_promises_enter_checking(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
as $$
declare
  v_promise        public.promises%rowtype;
  v_boundary       timestamptz;
  v_inserted       int;
  v_deadline_days  int := public.lf_policy_config_int('check_deadline_days');
  v_send_hour      int := public.lf_policy_config_int('reminder_send_hour_kst');
  v_schedule_count int := 0;
  v_promise_ids    uuid[] := '{}'::uuid[];
begin
  for v_promise in
    select p.*
      from public.promises p
     where p.status = 'ACTIVE'
       and p.end_date < (p_now at time zone 'Asia/Seoul')::date
     order by p.id
     for update
  loop
    v_boundary :=
      ((v_promise.end_date + 1)::timestamp at time zone 'Asia/Seoul');

    update public.promises
       set status = 'CHECKING',
           checking_started_at = v_boundary,
           check_deadline_at =
             v_boundary + make_interval(days => v_deadline_days),
           check_round_no = 1,
           lock_version = lock_version + 1,
           updated_at = p_now
     where id = v_promise.id
       and status = 'ACTIVE';

    if not found then
      continue;
    end if;

    insert into public.reminder_schedules (
      promise_id, user_id, kind, fire_at, check_round_no
    )
    select v_promise.id,
           pp.user_id,
           schedule.kind::public.reminder_kind,
           schedule.fire_at,
           1
      from public.promise_participants pp
      cross join lateral (
        values
          (
            'CHECK_REQ',
            (
              (v_promise.end_date + 1)::timestamp
              + make_interval(hours => v_send_hour)
            ) at time zone 'Asia/Seoul'
          ),
          (
            'CHECK_R1',
            (
              (v_promise.end_date + 3)::timestamp
              + make_interval(hours => v_send_hour)
            ) at time zone 'Asia/Seoul'
          ),
          (
            'CHECK_R2',
            (
              (v_promise.end_date + 6)::timestamp
              + make_interval(hours => v_send_hour)
            ) at time zone 'Asia/Seoul'
          )
      ) as schedule(kind, fire_at)
     where pp.promise_id = v_promise.id
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED'
       and pp.user_id is not null
    on conflict (promise_id, user_id, kind, check_round_no)
      where kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
        and check_round_no is not null
    do nothing;

    get diagnostics v_inserted = row_count;
    v_schedule_count := v_schedule_count + v_inserted;
    v_promise_ids := array_append(v_promise_ids, v_promise.id);
  end loop;

  return jsonb_build_object(
    'transitioned_count', cardinality(v_promise_ids),
    'promise_ids', to_jsonb(v_promise_ids),
    'schedule_count', v_schedule_count
  );
end;
$$;

comment on function public.lf_promises_enter_checking is
  'J-02. UUID 순서 blocking 잠금 뒤 원격 정책값으로 CHECKING 기한과 확인 일정을 만든다.';

-- ============================================================
-- J-03 — 일일 실행에서 잠긴 기한 경과 건을 유실하지 않는다
-- ============================================================

create or replace function public.lf_promises_close_due_checks(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
as $$
declare
  v_promise            public.promises%rowtype;
  v_check_count        int;
  v_status             public.promise_status;
  v_event              text;
  v_title              text;
  v_notification_count int;
  v_transition_date    text :=
    to_char((p_now at time zone 'Asia/Seoul')::date, 'YYYYMMDD');
  v_transitions        jsonb := '[]'::jsonb;
begin
  for v_promise in
    select p.*
      from public.promises p
     where p.status = 'CHECKING'
       and p.check_deadline_at <= p_now
     order by p.id
     for update
  loop
    select count(*)::int
      into v_check_count
      from public.fulfillment_checks fc
     where fc.promise_id = v_promise.id
       and fc.round_no = v_promise.check_round_no;

    if v_check_count >= 2 then
      continue;
    end if;

    if v_promise.check_round_no = 1 then
      v_status := 'UNRESOLVED';
      v_event := 'NT-14';
      v_title := '이행 확인 없이 종결됐어요';
    else
      v_status := 'DISPUTED';
      v_event := 'NT-13';
      v_title := '두 분의 확인이 서로 달라요';
    end if;

    update public.promises
       set status = v_status,
           closed_at = case when v_status = 'UNRESOLVED' then p_now else null end,
           lock_version = lock_version + 1,
           updated_at = p_now
     where id = v_promise.id
       and status = 'CHECKING';

    if not found then
      continue;
    end if;

    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = v_promise.id
       and kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
       and status = 'PENDING';

    perform public.lf_recompute_promise_trust_profiles(v_promise.id);

    insert into public.notifications (
      user_id,
      promise_id,
      type,
      channel,
      title,
      body,
      deeplink,
      status,
      dedupe_key,
      scheduled_at,
      sent_at,
      created_at
    )
    select pp.user_id,
           v_promise.id,
           v_event,
           'INAPP',
           v_title,
           v_promise.title,
           'SCR-A05',
           'SENT',
           concat_ws(
             ':',
             v_promise.id::text,
             v_event,
             pp.user_id::text,
             'INAPP',
             v_promise.check_round_no::text,
             v_transition_date
           ),
           p_now,
           p_now,
           p_now
      from public.promise_participants pp
     where pp.promise_id = v_promise.id
       and pp.status = 'JOINED'
       and pp.user_id is not null
       and (
         (v_promise.check_round_no = 1 and pp.role in ('CREATOR', 'PARTNER'))
         or
         (v_promise.check_round_no > 1 and pp.role in ('CREATOR', 'PARTNER', 'WITNESS'))
       )
    on conflict (dedupe_key) do nothing;

    get diagnostics v_notification_count = row_count;
    v_transitions := v_transitions || jsonb_build_array(
      jsonb_build_object(
        'promise_id', v_promise.id,
        'status', v_status,
        'round_no', v_promise.check_round_no,
        'notification_count', v_notification_count
      )
    );
  end loop;

  return jsonb_build_object(
    'transitioned_count', jsonb_array_length(v_transitions),
    'transitions', v_transitions
  );
end;
$$;

comment on function public.lf_promises_close_due_checks is
  'J-03. UUID 순서 blocking 잠금으로 기한 경과 라운드를 빠짐없이 종결한다.';

-- ============================================================
-- DISPUTED 재확인 — 원격 정책과 양측 신뢰 프로필을 같은 트랜잭션에 반영
-- ============================================================

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
  v_cached         jsonb;
  v_promise        public.promises%rowtype;
  v_actor_role     public.participant_role;
  v_now            timestamptz := now();
  v_round_no       int;
  v_deadline_days  int := public.lf_policy_config_int('check_deadline_days');
  v_send_hour      int := public.lf_policy_config_int('reminder_send_hour_kst');
  v_deadline       timestamptz;
  v_response       jsonb;
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
  v_deadline := v_now + make_interval(days => v_deadline_days);

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

  perform public.lf_recompute_promise_trust_profiles(p_promise_id);

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
          (
            ((v_now at time zone 'Asia/Seoul')::date + 2)::timestamp
            + make_interval(hours => v_send_hour)
          ) at time zone 'Asia/Seoul'
        ),
        (
          'CHECK_R2',
          (
            ((v_now at time zone 'Asia/Seoul')::date + 5)::timestamp
            + make_interval(hours => v_send_hour)
          ) at time zone 'Asia/Seoul'
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
  'DISPUTED를 원격 기한의 새 CHECKING 라운드로 열고 양측 프로필을 즉시 재계산한다.';

revoke all on function public.lf_promises_enter_checking(timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_promises_close_due_checks(timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_fulfillment_reopen(
  uuid, uuid, uuid, public.surface
) from public, anon, authenticated;

grant execute on function public.lf_promises_enter_checking(timestamptz)
  to service_role;
grant execute on function public.lf_promises_close_due_checks(timestamptz)
  to service_role;
grant execute on function public.lf_fulfillment_reopen(
  uuid, uuid, uuid, public.surface
) to service_role;
