-- F-11 알림 outbox, AMEND_REMIND, J-05 자동 만료.

alter table public.notification_outbox
  drop constraint notification_outbox_event_check;

alter table public.notification_outbox
  add constraint notification_outbox_event_check check (
    event in (
      'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05', 'NT-06', 'NT-07',
      'NT-08', 'NT-09', 'NT-10', 'NT-11', 'NT-12', 'NT-13', 'NT-14',
      'NT-15', 'NT-16', 'NT-17', 'NT-18', 'NT-19'
    )
  );

create unique index reminder_schedules_single_pending_amend
  on public.reminder_schedules (promise_id, user_id, kind)
  where kind = 'AMEND_REMIND' and status = 'PENDING';

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
  v_recipient_id uuid;
  v_request public.amend_requests%rowtype;
  v_amend_type public.amend_type;
  v_amend_decision text;
begin
  if new.action in ('AMEND_REQUEST', 'CANCEL_REQUEST') then
    v_amend_type := case new.action
      when 'AMEND_REQUEST' then 'AMEND'::public.amend_type
      else 'CANCEL'::public.amend_type
    end;
    select ar.*
      into v_request
      from public.amend_requests ar
     where ar.promise_id = new.promise_id
       and ar.requester_id = new.user_id
       and ar.type = v_amend_type
       and ar.status = 'PENDING'
     order by ar.created_at desc, ar.id desc
     limit 1;
    if not found then raise exception 'E_STATE_CONFLICT'; end if;

    select p.title, actor.nickname, recipient.user_id
      into v_promise_title, v_partner_nickname, v_recipient_id
      from public.promises p
      join public.users actor on actor.id = new.user_id
      join public.promise_participants recipient
        on recipient.promise_id = p.id
       and recipient.role in ('CREATOR', 'PARTNER')
       and recipient.status = 'JOINED'
       and recipient.user_id <> new.user_id
     where p.id = new.promise_id;
    if v_recipient_id is null then raise exception 'E_STATE_CONFLICT'; end if;

    perform public.lf_notification_outbox_enqueue(
      v_recipient_id,
      new.promise_id,
      'NT-15',
      jsonb_build_object(
        'partnerNickname', v_partner_nickname,
        'promiseTitle', v_promise_title,
        'amendType', v_amend_type
      ),
      'amend-request:' || v_request.id::text,
      new.acted_at
    );

    insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
    values (
      new.promise_id,
      v_recipient_id,
      'AMEND_REMIND',
      (
        ((v_request.created_at at time zone 'Asia/Seoul')::date + 3)::timestamp
        + interval '9 hours'
      ) at time zone 'Asia/Seoul'
    )
    on conflict (promise_id, user_id, kind)
      where kind = 'AMEND_REMIND' and status = 'PENDING'
      do nothing;
    return new;
  end if;

  if new.action in ('AMEND_APPROVE', 'AMEND_DECLINE', 'CANCEL_APPROVE', 'CANCEL_DECLINE') then
    v_amend_type := case
      when new.action in ('AMEND_APPROVE', 'AMEND_DECLINE')
        then 'AMEND'::public.amend_type
      else 'CANCEL'::public.amend_type
    end;
    v_amend_decision := case
      when new.action in ('AMEND_APPROVE', 'CANCEL_APPROVE') then 'APPROVE'
      else 'DECLINE'
    end;
    select ar.*
      into v_request
      from public.amend_requests ar
     where ar.promise_id = new.promise_id
       and ar.responded_by = new.user_id
       and ar.type = v_amend_type
       and ar.status = case when v_amend_decision = 'APPROVE'
         then 'APPROVED'::public.amend_status
         else 'DECLINED'::public.amend_status
       end
     order by ar.responded_at desc, ar.id desc
     limit 1;
    if not found then raise exception 'E_STATE_CONFLICT'; end if;

    select p.title into strict v_promise_title
      from public.promises p where p.id = new.promise_id;
    perform public.lf_notification_outbox_enqueue(
      v_request.requester_id,
      new.promise_id,
      'NT-16',
      jsonb_build_object(
        'promiseTitle', v_promise_title,
        'amendDecision', v_amend_decision
      ),
      'amend-response:' || v_request.id::text || ':' || lower(v_amend_decision),
      new.acted_at
    );
    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = new.promise_id
       and kind = 'AMEND_REMIND'
       and status = 'PENDING';
    return new;
  end if;

  if new.action = 'AMEND_WITHDRAW' then
    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = new.promise_id
       and kind = 'AMEND_REMIND'
       and status = 'PENDING';
    return new;
  end if;

  if new.role <> 'PARTNER' or new.version_id is null then
    return new;
  end if;

  v_event := case new.action
    when 'APPROVE' then 'NT-01'
    when 'DECLINE' then 'NT-02'
    when 'AMEND_SUGGEST' then 'NT-03'
    else null
  end;
  if v_event is null then return new; end if;

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
           ar.id as amend_request_id,
           ar.requester_id as amend_requester_id,
           ar.type as amend_type,
           requester.nickname as amend_requester_nickname,
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
      left join public.amend_requests ar
        on ar.promise_id = p.id and ar.status = 'PENDING'
      left join public.users requester on requester.id = ar.requester_id
     where rs.status = 'PENDING'
       and rs.fire_at <= p_now
       and u.status <> 'SUSPENDED'
       and (
         (rs.kind in ('D7', 'D3', 'D1', 'DDAY') and p.status in ('ACTIVE', 'AMEND_PENDING'))
         or (rs.kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2') and p.status = 'CHECKING')
         or (rs.kind = 'INVITE_EXPIRE_SOON' and p.status = 'PENDING')
         or (rs.kind = 'AMEND_REMIND')
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
       or (
         v_row.kind = 'AMEND_REMIND'
         and (
           v_row.promise_status <> 'AMEND_PENDING'
           or v_row.amend_request_id is null
           or v_row.user_id = v_row.amend_requester_id
         )
       )
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
      when 'AMEND_REMIND' then
        v_event := 'NT-15';
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
          'days', case when v_event in ('NT-06', 'NT-10') then v_days else null end,
          'partnerNickname', case when v_event = 'NT-15'
            then v_row.amend_requester_nickname else null end,
          'amendType', case when v_event = 'NT-15' then v_row.amend_type else null end
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

create or replace function public.lf_expire_amend_requests(
  p_now timestamptz default now(),
  p_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_recipient record;
  v_expired int := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j05-amend-expiry', 0)
  );

  for v_row in
    select ar.id as request_id, p.id as promise_id, p.title as promise_title
      from public.promises p
      join public.amend_requests ar on ar.promise_id = p.id
     where p.status = 'AMEND_PENDING'
       and ar.status = 'PENDING'
       and ar.expires_at <= p_now
     order by p.id, ar.id
     limit greatest(p_limit, 0)
     for update of p, ar skip locked
  loop
    update public.amend_requests
       set status = 'EXPIRED', responded_at = p_now
     where id = v_row.request_id and status = 'PENDING';
    if not found then continue; end if;

    update public.promises
       set status = 'ACTIVE', lock_version = lock_version + 1, updated_at = p_now
     where id = v_row.promise_id and status = 'AMEND_PENDING';
    if not found then raise exception 'E_STATE_CONFLICT'; end if;

    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = v_row.promise_id
       and kind = 'AMEND_REMIND'
       and status = 'PENDING';

    for v_recipient in
      select pp.user_id
        from public.promise_participants pp
       where pp.promise_id = v_row.promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED'
       order by pp.user_id
    loop
      perform public.lf_notification_outbox_enqueue(
        v_recipient.user_id,
        v_row.promise_id,
        'NT-17',
        jsonb_build_object('promiseTitle', v_row.promise_title),
        'amend-expired:' || v_row.request_id::text,
        p_now
      );
    end loop;
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('expired', v_expired);
end;
$$;

create or replace function public.lf_schedule_amend_expiry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j05-amend-expiry-scheduler', 0)
  );
  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;

  for v_job_id in
    select jobid from cron.job where jobname = 'lf-amend-request-expiry'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'lf-amend-request-expiry',
    '30 15 * * *',
    'select public.lf_expire_amend_requests();'
  );
end;
$$;

revoke all on function public.lf_expire_amend_requests(timestamptz, int)
  from public, anon, authenticated;
revoke all on function public.lf_schedule_amend_expiry()
  from public, anon, authenticated;
grant execute on function public.lf_expire_amend_requests(timestamptz, int) to service_role;
grant execute on function public.lf_schedule_amend_expiry() to service_role;

select public.lf_schedule_amend_expiry();
