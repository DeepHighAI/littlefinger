-- F-06 내구성 outbox — 상태 전이와 알림 intent를 같은 트랜잭션에 묶는다.

create type public.notification_outbox_status as enum (
  'PENDING',
  'LEASED',
  'PROCESSED',
  'FAILED'
);

-- server-only: notification_outbox — 소비자 worker와 전이 트리거만 접근한다.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  promise_id uuid not null references public.promises (id) on delete cascade,
  event text not null check (
    event in (
      'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05', 'NT-06', 'NT-07',
      'NT-08', 'NT-09', 'NT-10', 'NT-11', 'NT-12', 'NT-13', 'NT-14', 'NT-19'
    )
  ),
  template_args jsonb not null check (jsonb_typeof(template_args) = 'object'),
  body_snapshot text,
  inapp_dedupe_key text not null unique,
  push_dedupe_key text not null unique,
  status public.notification_outbox_status not null default 'PENDING',
  attempt_count int not null default 0 check (attempt_count between 0 and 4),
  lease_id uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  leased_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_lease_shape check (
    (status = 'LEASED' and lease_id is not null and lease_expires_at is not null)
    or
    (status <> 'LEASED' and lease_id is null and lease_expires_at is null)
  )
);

create index notification_outbox_due_idx
  on public.notification_outbox (status, next_attempt_at, created_at);

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from public, anon, authenticated, service_role;

create or replace function public.lf_notification_outbox_enqueue(
  p_user_id uuid,
  p_promise_id uuid,
  p_event text,
  p_template_args jsonb,
  p_dedupe_scope text,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_inapp_key text := concat_ws(
    ':', p_promise_id::text, p_event, p_user_id::text, 'INAPP', p_dedupe_scope
  );
  v_push_key text := concat_ws(
    ':', p_promise_id::text, p_event, p_user_id::text, 'PUSH', p_dedupe_scope
  );
begin
  insert into public.notification_outbox (
    recipient_user_id,
    promise_id,
    event,
    template_args,
    inapp_dedupe_key,
    push_dedupe_key,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_promise_id,
    p_event,
    p_template_args,
    v_inapp_key,
    v_push_key,
    p_now,
    p_now,
    p_now
  )
  on conflict (inapp_dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    select o.id
      into v_id
      from public.notification_outbox o
     where o.inapp_dedupe_key = v_inapp_key;
  end if;

  return v_id;
end;
$$;

create or replace function public.lf_notification_outbox_claim(
  p_now timestamptz default now(),
  p_limit int default 100,
  p_lease_seconds int default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_limit < 0 or p_lease_seconds < 1 then
    raise exception 'E_VALIDATION';
  end if;

  -- 네 번째 worker가 fanout 뒤 죽어 record를 못 불러도 영구 LEASED로 남기지 않는다.
  update public.notification_outbox
     set status = 'FAILED',
         lease_id = null,
         lease_expires_at = null,
         last_error_code = 'LEASE_EXPIRED',
         failed_at = p_now,
         updated_at = p_now
   where status = 'LEASED'
     and lease_expires_at <= p_now
     and attempt_count >= 4;

  -- worker crash도 처리 실패와 같은 간격을 거쳐야 재시도 폭주와 lease 소진을 막는다.
  update public.notification_outbox
     set status = 'PENDING',
         next_attempt_at = lease_expires_at + make_interval(
           secs => case attempt_count
             when 1 then 60
             when 2 then 300
             when 3 then 900
           end
         ),
         lease_id = null,
         lease_expires_at = null,
         last_error_code = 'LEASE_EXPIRED',
         updated_at = p_now
   where status = 'LEASED'
     and lease_expires_at <= p_now
     and attempt_count between 1 and 3;

  with candidates as (
    select o.id
      from public.notification_outbox o
     where o.status = 'PENDING'
       and o.next_attempt_at <= p_now
     order by o.next_attempt_at, o.created_at, o.id
     limit p_limit
     for update skip locked
  ), leased as (
    update public.notification_outbox o
       set status = 'LEASED',
           attempt_count = o.attempt_count + 1,
           lease_id = gen_random_uuid(),
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           leased_at = p_now,
           updated_at = p_now
      from candidates c
     where o.id = c.id
       and o.attempt_count < 4
    returning o.*
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', l.id,
               'recipient_user_id', l.recipient_user_id,
               'promise_id', l.promise_id,
               'event', l.event,
               'template_args', l.template_args,
               'body_snapshot', l.body_snapshot,
               'inapp_dedupe_key', l.inapp_dedupe_key,
               'push_dedupe_key', l.push_dedupe_key,
               'status', l.status,
               'attempt_count', l.attempt_count,
               'lease_id', l.lease_id,
               'lease_expires_at', l.lease_expires_at
             )
             order by l.next_attempt_at, l.created_at, l.id
           ),
           '[]'::jsonb
         )
    into v_result
    from leased l;

  return v_result;
end;
$$;

create or replace function public.lf_notification_outbox_record(
  p_outbox_id uuid,
  p_lease_id uuid,
  p_success boolean,
  p_body_snapshot text,
  p_error_code text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_outbox%rowtype;
  v_delay_seconds int;
begin
  select *
    into v_row
    from public.notification_outbox o
   where o.id = p_outbox_id
     and o.status = 'LEASED'
     and o.lease_id = p_lease_id
   for update;

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if p_success then
    if p_body_snapshot is null then
      raise exception 'E_VALIDATION';
    end if;
    update public.notification_outbox
       set status = 'PROCESSED',
           body_snapshot = p_body_snapshot,
           lease_id = null,
           lease_expires_at = null,
           last_error_code = null,
           processed_at = p_now,
           failed_at = null,
           updated_at = p_now
     where id = p_outbox_id;
  elsif v_row.attempt_count >= 4 then
    update public.notification_outbox
       set status = 'FAILED',
           body_snapshot = coalesce(p_body_snapshot, body_snapshot),
           lease_id = null,
           lease_expires_at = null,
           last_error_code = coalesce(nullif(p_error_code, ''), 'PROCESSING_FAILED'),
           failed_at = p_now,
           updated_at = p_now
     where id = p_outbox_id;
  else
    v_delay_seconds := case v_row.attempt_count
      when 1 then 60
      when 2 then 300
      when 3 then 900
    end;
    update public.notification_outbox
       set status = 'PENDING',
           body_snapshot = coalesce(p_body_snapshot, body_snapshot),
           lease_id = null,
           lease_expires_at = null,
           next_attempt_at = p_now + make_interval(secs => v_delay_seconds),
           last_error_code = coalesce(nullif(p_error_code, ''), 'PROCESSING_FAILED'),
           updated_at = p_now
     where id = p_outbox_id;
  end if;

  select * into v_row from public.notification_outbox where id = p_outbox_id;
  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'attempt_count', v_row.attempt_count,
    'next_attempt_at', v_row.next_attempt_at,
    'processed_at', v_row.processed_at,
    'failed_at', v_row.failed_at
  );
end;
$$;

create or replace function public.lf_notification_outbox_requeue(
  p_outbox_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_outbox%rowtype;
begin
  update public.notification_outbox
     set status = 'PENDING',
         attempt_count = 0,
         next_attempt_at = p_now,
         last_error_code = null,
         failed_at = null,
         updated_at = p_now
   where id = p_outbox_id
     and status = 'FAILED'
  returning * into v_row;

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'attempt_count', v_row.attempt_count,
    'next_attempt_at', v_row.next_attempt_at
  );
end;
$$;

revoke all on function public.lf_notification_outbox_enqueue(
  uuid, uuid, text, jsonb, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.lf_notification_outbox_claim(
  timestamptz, int, int
) from public, anon, authenticated;
revoke all on function public.lf_notification_outbox_record(
  uuid, uuid, boolean, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.lf_notification_outbox_requeue(
  uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.lf_notification_outbox_enqueue(
  uuid, uuid, text, jsonb, text, timestamptz
) to service_role;
grant execute on function public.lf_notification_outbox_claim(
  timestamptz, int, int
) to service_role;
grant execute on function public.lf_notification_outbox_record(
  uuid, uuid, boolean, text, text, timestamptz
) to service_role;
grant execute on function public.lf_notification_outbox_requeue(
  uuid, timestamptz
) to service_role;

create or replace function public.lf_notification_outbox_count(
  p_promise_id uuid,
  p_event text,
  p_dedupe_scope text
)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
    from public.notification_outbox o
   where o.promise_id = p_promise_id
     and o.event = p_event
     and right(o.inapp_dedupe_key, length(p_dedupe_scope) + 1) = ':' || p_dedupe_scope;
$$;

revoke all on function public.lf_notification_outbox_count(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.lf_notification_outbox_count(uuid, text, text)
  to service_role;

-- 승인 로그는 행위자와 요청 종류를 모두 가진 가장 늦은 원자적 생산 지점이다.
create or replace function public.lf_approval_notification_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_creator_id uuid;
  v_promise_title text;
  v_partner_nickname text;
begin
  if new.role <> 'PARTNER' or new.version_id is null then
    return new;
  end if;

  v_event := case new.action
    when 'APPROVE' then 'NT-01'
    when 'DECLINE' then 'NT-02'
    when 'AMEND_SUGGEST' then 'NT-03'
    else null
  end;
  if v_event is null then
    return new;
  end if;

  select p.creator_id, pv.title, u.nickname
    into v_creator_id, v_promise_title, v_partner_nickname
    from public.promises p
    join public.promise_versions pv on pv.id = new.version_id
    join public.users u on u.id = new.user_id
   where p.id = new.promise_id;

  perform public.lf_notification_outbox_enqueue(
    v_creator_id,
    new.promise_id,
    v_event,
    jsonb_build_object(
      'partnerNickname', v_partner_nickname,
      'promiseTitle', v_promise_title
    ),
    'approval:' || new.id::text,
    new.acted_at
  );
  return new;
end;
$$;

create trigger approval_notification_outbox
after insert on public.approvals
for each row execute function public.lf_approval_notification_outbox();

-- 첫 이행 응답만 상대방에게 알린다. 두 번째 응답의 종결 알림은 promises 트리거가 맡는다.
create or replace function public.lf_fulfillment_check_notification_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promise_title text;
  v_actor_nickname text;
  v_recipient record;
begin
  if exists (
    select 1
      from public.fulfillment_checks fc
     where fc.promise_id = new.promise_id
       and fc.round_no = new.round_no
       and fc.id <> new.id
  ) then
    return new;
  end if;

  select p.title, u.nickname
    into v_promise_title, v_actor_nickname
    from public.promises p
    join public.users u on u.id = new.user_id
   where p.id = new.promise_id;

  for v_recipient in
    select pp.user_id
      from public.promise_participants pp
     where pp.promise_id = new.promise_id
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED'
       and pp.user_id <> new.user_id
  loop
    perform public.lf_notification_outbox_enqueue(
      v_recipient.user_id,
      new.promise_id,
      'NT-09',
      jsonb_build_object(
        'partnerNickname', v_actor_nickname,
        'promiseTitle', v_promise_title
      ),
      'check:' || new.id::text,
      new.submitted_at
    );
  end loop;
  return new;
end;
$$;

create trigger fulfillment_check_notification_outbox
after insert on public.fulfillment_checks
for each row execute function public.lf_fulfillment_check_notification_outbox();

-- 종결과 재확인은 상태 행 자체가 직렬화 지점이라 같은 트랜잭션에서 intent를 만든다.
create or replace function public.lf_promise_status_notification_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_actor uuid;
  v_recipient record;
  v_roles public.participant_role[];
  v_scope text;
begin
  if old.status = 'CHECKING' and new.status in ('COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED') then
    v_event := case new.status
      when 'COMPLETED' then 'NT-11'
      when 'BROKEN' then 'NT-12'
      when 'DISPUTED' then 'NT-13'
      when 'UNRESOLVED' then 'NT-14'
    end;
    v_roles := case
      when new.status = 'UNRESOLVED'
        then array['CREATOR', 'PARTNER']::public.participant_role[]
      else array['CREATOR', 'PARTNER', 'WITNESS']::public.participant_role[]
    end;
    v_scope := concat_ws(':', 'closure', new.check_round_no::text, new.status::text);
  elsif old.status = 'DISPUTED' and new.status = 'CHECKING' then
    v_event := 'NT-19';
    v_roles := array['CREATOR', 'PARTNER']::public.participant_role[];
    v_scope := 'reopen:' || new.check_round_no::text;
    select k.user_id
      into v_actor
      from public.idempotency_keys k
     where k.endpoint = 'fulfillment-reopen'
       and k.response is null
     order by k.created_at desc
     limit 1;
  else
    return new;
  end if;

  for v_recipient in
    select pp.user_id
      from public.promise_participants pp
     where pp.promise_id = new.id
       and pp.role = any(v_roles)
       and pp.status = 'JOINED'
       and (v_actor is null or pp.user_id <> v_actor)
  loop
    perform public.lf_notification_outbox_enqueue(
      v_recipient.user_id,
      new.id,
      v_event,
      jsonb_build_object('promiseTitle', new.title),
      v_scope,
      new.updated_at
    );
  end loop;
  return new;
end;
$$;

create trigger promise_status_notification_outbox
after update of status on public.promises
for each row execute function public.lf_promise_status_notification_outbox();

revoke all on function public.lf_approval_notification_outbox()
  from public, anon, authenticated;
revoke all on function public.lf_fulfillment_check_notification_outbox()
  from public, anon, authenticated;
revoke all on function public.lf_promise_status_notification_outbox()
  from public, anon, authenticated;

-- J-01은 채널 fanout 대신 outbox intent의 커밋을 SENT 기준으로 삼는다.
create or replace function public.lf_dispatch_due_reminders(
  p_now timestamptz default now(),
  p_limit int default 200
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_kst_date date := (p_now at time zone 'Asia/Seoul')::date;
  v_ymd text := to_char((p_now at time zone 'Asia/Seoul')::date, 'YYYYMMDD');
  v_hour int := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  v_quiet_start int := public.lf_policy_config_int('quiet_hours_start_kst');
  v_quiet_end int := public.lf_policy_config_int('quiet_hours_end_kst');
  v_quiet boolean;
  v_defer_until timestamptz;
  v_row record;
  v_event text;
  v_days int;
  v_sent int := 0;
  v_canceled int := 0;
  v_deferred int := 0;
begin
  v_quiet := case
    when v_quiet_start > v_quiet_end then v_hour >= v_quiet_start or v_hour < v_quiet_end
    else v_hour >= v_quiet_start and v_hour < v_quiet_end
  end;
  v_defer_until := case
    when not v_quiet then null
    when v_hour < v_quiet_end
      then (v_kst_date::timestamp + make_interval(hours => v_quiet_end)) at time zone 'Asia/Seoul'
    else ((v_kst_date + 1)::timestamp + make_interval(hours => v_quiet_end)) at time zone 'Asia/Seoul'
  end;

  for v_row in
    select rs.id as schedule_id,
           rs.kind,
           rs.user_id,
           rs.promise_id,
           p.status as promise_status,
           p.title as promise_title,
           p.end_date,
           p.check_deadline_at,
           u.status as user_status,
           coalesce(
             u.notification_pref ->> case rs.kind
               when 'D7' then 'remind_d7'
               when 'D3' then 'remind_d3'
               when 'D1' then 'remind_d1'
               when 'DDAY' then 'remind_dday'
               else null
             end,
             'true'
           ) as pref
      from public.reminder_schedules rs
      join public.promises p on p.id = rs.promise_id
      join public.users u on u.id = rs.user_id
     where rs.status = 'PENDING'
       and rs.fire_at <= p_now
       and rs.kind <> 'AMEND_REMIND'
       and u.status <> 'SUSPENDED'
       and (
         (rs.kind in ('D7', 'D3', 'D1', 'DDAY') and p.status in ('ACTIVE', 'AMEND_PENDING'))
         or (rs.kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2') and p.status = 'CHECKING')
         or (rs.kind = 'INVITE_EXPIRE_SOON' and p.status = 'PENDING')
         or p.status in ('COMPLETED', 'BROKEN', 'UNRESOLVED', 'CANCELED', 'DECLINED')
         or (rs.kind in ('D7', 'D3', 'D1', 'DDAY') and p.status in ('CHECKING', 'DISPUTED'))
         or (rs.kind = 'INVITE_EXPIRE_SOON' and p.status <> 'PENDING')
         or u.status = 'WITHDRAWN'
       )
     order by rs.fire_at, rs.id
     limit greatest(p_limit, 0)
     for update of rs skip locked
  loop
    if v_row.user_status = 'WITHDRAWN'
       or v_row.promise_status in ('COMPLETED', 'BROKEN', 'UNRESOLVED', 'CANCELED', 'DECLINED')
       or (v_row.kind in ('D7', 'D3', 'D1', 'DDAY')
           and v_row.promise_status in ('CHECKING', 'DISPUTED'))
       or (v_row.kind = 'INVITE_EXPIRE_SOON' and v_row.promise_status <> 'PENDING')
    then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    if v_row.pref = 'false' then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    v_days := null;
    case v_row.kind
      when 'D7', 'D3', 'D1' then
        v_event := 'NT-06';
        v_days := v_row.end_date - v_kst_date;
      when 'DDAY' then
        v_event := 'NT-07';
        v_days := case when v_row.end_date = v_kst_date then 1 else 0 end;
      when 'CHECK_REQ' then
        v_event := 'NT-08';
        v_days := 1;
      when 'CHECK_R1', 'CHECK_R2' then
        v_event := 'NT-10';
        v_days := (v_row.check_deadline_at at time zone 'Asia/Seoul')::date - v_kst_date;
      when 'INVITE_EXPIRE_SOON' then
        v_event := 'NT-04';
        v_days := 1;
    end case;

    if v_days is null or v_days < 1 then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    if v_quiet then
      update public.reminder_schedules set fire_at = v_defer_until where id = v_row.schedule_id;
      v_deferred := v_deferred + 1;
      continue;
    end if;

    perform public.lf_notification_outbox_enqueue(
      v_row.user_id,
      v_row.promise_id,
      v_event,
      jsonb_strip_nulls(
        jsonb_build_object(
          'promiseTitle', v_row.promise_title,
          'days', case when v_event in ('NT-06', 'NT-10') then v_days else null end
        )
      ),
      v_ymd,
      p_now
    );

    update public.reminder_schedules set status = 'SENT' where id = v_row.schedule_id;
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object(
    'claimed', v_sent + v_canceled + v_deferred,
    'sent', v_sent,
    'canceled', v_canceled,
    'deferred', v_deferred
  );
end;
$$;

revoke all on function public.lf_dispatch_due_reminders(timestamptz, int)
  from public, anon, authenticated;
grant execute on function public.lf_dispatch_due_reminders(timestamptz, int)
  to service_role;

-- J-03 종결도 SQL 문구를 직접 쓰지 않고 promises 상태 트리거의 outbox intent를 사용한다.
create or replace function public.lf_promises_close_due_checks(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_promise public.promises%rowtype;
  v_check_count int;
  v_status public.promise_status;
  v_event text;
  v_notification_count int;
  v_transitions jsonb := '[]'::jsonb;
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
    else
      v_status := 'DISPUTED';
      v_event := 'NT-13';
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

    v_notification_count := public.lf_notification_outbox_count(
      v_promise.id,
      v_event,
      concat_ws(':', 'closure', v_promise.check_round_no::text, v_status::text)
    );

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

revoke all on function public.lf_promises_close_due_checks(timestamptz)
  from public, anon, authenticated;
grant execute on function public.lf_promises_close_due_checks(timestamptz)
  to service_role;
