-- F-07 J-02/J-03 배치와 DISPUTED 재확인 라운드.
--
-- 배치 상태 조건, 일정·알림 UNIQUE 제약, 약속 행 잠금이 함께 멱등 경계를 이룬다.
-- 종결 프로필은 Task 1의 UUID 정렬 helper를 재사용해 교차 잠금 순서를 유지한다.

alter table public.reminder_schedules
  add column if not exists check_round_no int;

create unique index if not exists reminder_schedules_check_round_unique
  on public.reminder_schedules (promise_id, user_id, kind, check_round_no)
  where kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2')
    and check_round_no is not null;

create or replace function public.lf_promises_enter_checking(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
as $$
declare
  v_promise       public.promises%rowtype;
  v_boundary      timestamptz;
  v_inserted      int;
  v_schedule_count int := 0;
  v_promise_ids   uuid[] := '{}'::uuid[];
begin
  for v_promise in
    select p.*
      from public.promises p
     where p.status = 'ACTIVE'
       and p.end_date < (p_now at time zone 'Asia/Seoul')::date
     order by p.id
     for update skip locked
  loop
    v_boundary :=
      ((v_promise.end_date + 1)::timestamp at time zone 'Asia/Seoul');

    update public.promises
       set status = 'CHECKING',
           checking_started_at = v_boundary,
           check_deadline_at = v_boundary + interval '7 days',
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
            ((v_promise.end_date + 1 + time '09:00') at time zone 'Asia/Seoul')
          ),
          (
            'CHECK_R1',
            ((v_promise.end_date + 3 + time '09:00') at time zone 'Asia/Seoul')
          ),
          (
            'CHECK_R2',
            ((v_promise.end_date + 6 + time '09:00') at time zone 'Asia/Seoul')
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
  'J-02. 종료일 다음 KST 자정 기준으로 ACTIVE 약속을 CHECKING으로 전환하고 확인 일정을 만든다.';

create or replace function public.lf_promises_close_due_checks(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
as $$
declare
  v_promise           public.promises%rowtype;
  v_check_count       int;
  v_status            public.promise_status;
  v_event             text;
  v_title             text;
  v_notification_count int;
  v_transition_date   text :=
    to_char((p_now at time zone 'Asia/Seoul')::date, 'YYYYMMDD');
  v_transitions       jsonb := '[]'::jsonb;
begin
  for v_promise in
    select p.*
      from public.promises p
     where p.status = 'CHECKING'
       and p.check_deadline_at <= p_now
     order by p.id
     for update skip locked
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
  'J-03. 응답이 둘 미만인 만료 라운드를 UNRESOLVED 또는 DISPUTED로 전환하고 INAPP 결과를 남긴다.';

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
  'DISPUTED 약속을 새 7일 CHECKING 라운드로 연다. 같은 멱등 키는 최초 응답을 재생한다.';

revoke all on function public.lf_promises_enter_checking(timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_promises_close_due_checks(timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)
  from public, anon, authenticated;

grant execute on function public.lf_promises_enter_checking(timestamptz) to service_role;
grant execute on function public.lf_promises_close_due_checks(timestamptz) to service_role;
grant execute on function public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)
  to service_role;

-- 실제 Supabase에는 pg_cron 확장을 켜고, PGlite 하니스는 같은 공개 함수·카탈로그를 제공한다.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    execute 'create extension if not exists pg_cron';
  end if;
end;
$$;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'lf-promises-enter-checking'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'lf-promises-enter-checking',
    '10 15 * * *',
    'select public.lf_promises_enter_checking();'
  );

  for v_job in
    select jobid from cron.job where jobname = 'lf-promises-close-due-checks'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'lf-promises-close-due-checks',
    '20 15 * * *',
    'select public.lf_promises_close_due_checks();'
  );
end;
$$;
