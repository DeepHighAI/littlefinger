-- J-04 초대 만료, J-06 초안 알림·정리, NT-20/21.

alter table public.notification_outbox
  drop constraint notification_outbox_event_check;

alter table public.notification_outbox
  add constraint notification_outbox_event_check check (
    event in (
      'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05', 'NT-06', 'NT-07',
      'NT-08', 'NT-09', 'NT-10', 'NT-11', 'NT-12', 'NT-13', 'NT-14',
      'NT-15', 'NT-16', 'NT-17', 'NT-18', 'NT-19', 'NT-20', 'NT-21'
    )
  );

insert into public.app_configs (key, value)
values
  ('draft_ttl_days', '90'::jsonb),
  ('min_app_version', to_jsonb('0.1.0'::text))
on conflict (key) do nothing;

create or replace function public.lf_policy_config_int(p_key text)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_value jsonb;
  v_numeric numeric;
  v_default int;
  v_min int;
  v_max int;
begin
  case p_key
    when 'check_deadline_days' then
      v_default := 7; v_min := 1; v_max := 2147483647;
    when 'reminder_send_hour_kst' then
      v_default := 9; v_min := 0; v_max := 23;
    when 'quiet_hours_start_kst' then
      v_default := 21; v_min := 0; v_max := 23;
    when 'quiet_hours_end_kst' then
      v_default := 8; v_min := 0; v_max := 23;
    when 'draft_ttl_days' then
      v_default := 90; v_min := 8; v_max := 2147483647;
    else
      return null;
  end case;

  select ac.value into v_value
    from public.app_configs ac
   where ac.key = p_key;
  if v_value is null or jsonb_typeof(v_value) <> 'number' then return v_default; end if;

  begin
    v_numeric := (v_value #>> '{}')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then return v_default;
  end;
  if v_numeric = trunc(v_numeric) and v_numeric between v_min and v_max then
    return v_numeric::int;
  end if;
  return v_default;
end;
$$;

-- 확정되지 않은 DRAFT 자체가 수명주기로 삭제될 때 그 초안의 수정 제안 로그만 함께 사라진다.
-- 확정 약속은 삭제 경로가 없으므로 승인 기록의 append-only 계약에는 영향이 없다.
alter table public.approvals drop constraint approvals_promise_id_fkey;
alter table public.approvals
  add constraint approvals_promise_id_fkey
  foreign key (promise_id) references public.promises (id) on delete cascade;

create unique index reminder_schedules_single_pending_draft_kind
  on public.reminder_schedules (promise_id, user_id, kind)
  where status = 'PENDING'
    and kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON');

create or replace function public.lf_expire_invitations(
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
  v_expired int := 0;
  v_notified int := 0;
begin
  for v_row in
    select i.id as invitation_id,
           p.id as promise_id,
           p.creator_id,
           p.title as promise_title
      from public.invitations i
      join public.promises p on p.id = i.promise_id
     where i.status = 'PENDING'
       and i.expires_at <= p_now
     order by i.expires_at, i.id
     limit greatest(p_limit, 0)
     for update of i skip locked
  loop
    update public.invitations
       set status = 'EXPIRED'
     where id = v_row.invitation_id and status = 'PENDING';
    if not found then continue; end if;

    perform public.lf_notification_outbox_enqueue(
      v_row.creator_id,
      v_row.promise_id,
      'NT-05',
      jsonb_build_object('promiseTitle', v_row.promise_title),
      'invite-expired:' || v_row.invitation_id::text,
      p_now
    );
    v_expired := v_expired + 1;
    v_notified := v_notified + 1;
  end loop;
  return jsonb_build_object('expired', v_expired, 'notified', v_notified);
end;
$$;

create or replace function public.lf_prepare_draft_cleanup(
  p_now timestamptz default now(),
  p_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ttl_days int := public.lf_policy_config_int('draft_ttl_days');
  v_changed int;
  v_scheduled int := 0;
  v_deleted int := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j06-draft-cleanup', 0)
  );

  insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
  select candidate.promise_id,
         candidate.creator_id,
         'DRAFT_RESUME'::public.reminder_kind,
         candidate.updated_at + interval '3 days'
    from (
      select p.id as promise_id, p.creator_id, p.updated_at
        from public.promises p
       where p.status = 'DRAFT'
         and p.updated_at > p_now - make_interval(days => v_ttl_days)
         and exists (
           select 1 from public.approvals a
            where a.promise_id = p.id and a.action = 'AMEND_SUGGEST'
         )
       order by p.updated_at, p.id
       limit greatest(p_limit, 0)
       for update of p skip locked
    ) candidate
   where not exists (
     select 1 from public.reminder_schedules existing
      where existing.promise_id = candidate.promise_id
        and existing.user_id = candidate.creator_id
        and existing.kind = 'DRAFT_RESUME'
        and existing.status <> 'PENDING'
   )
  on conflict (promise_id, user_id, kind)
    where status = 'PENDING' and kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON')
  do update set fire_at = excluded.fire_at
    where reminder_schedules.fire_at is distinct from excluded.fire_at;
  get diagnostics v_changed = row_count;
  v_scheduled := v_scheduled + v_changed;

  insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
  select candidate.promise_id,
         candidate.creator_id,
         'DRAFT_DELETE_SOON'::public.reminder_kind,
         candidate.updated_at + make_interval(days => v_ttl_days - 7)
    from (
      select p.id as promise_id, p.creator_id, p.updated_at
        from public.promises p
       where p.status = 'DRAFT'
       order by p.updated_at, p.id
       limit greatest(p_limit, 0)
       for update of p skip locked
    ) candidate
   where not exists (
     select 1 from public.reminder_schedules existing
      where existing.promise_id = candidate.promise_id
        and existing.user_id = candidate.creator_id
        and existing.kind = 'DRAFT_DELETE_SOON'
        and existing.status <> 'PENDING'
   )
  on conflict (promise_id, user_id, kind)
    where status = 'PENDING' and kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON')
  do update set fire_at = excluded.fire_at
    where reminder_schedules.fire_at is distinct from excluded.fire_at;
  get diagnostics v_changed = row_count;
  v_scheduled := v_scheduled + v_changed;

  with due as (
    select p.id
      from public.promises p
     where p.status = 'DRAFT'
       and p.updated_at <= p_now - make_interval(days => v_ttl_days)
       and exists (
         select 1 from public.reminder_schedules sent
          where sent.promise_id = p.id
            and sent.user_id = p.creator_id
            and sent.kind = 'DRAFT_DELETE_SOON'
            and sent.status = 'SENT'
       )
     order by p.updated_at, p.id
     limit greatest(p_limit, 0)
     for update of p skip locked
  )
  delete from public.promises p using due where p.id = due.id;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'scheduled', v_scheduled);
end;
$$;

-- J-01: 기존 예약과 초안 예약을 같은 트랜잭션·quiet-hours 규칙으로 발송한다.
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
         or rs.kind in ('AMEND_REMIND', 'DRAFT_RESUME', 'DRAFT_DELETE_SOON')
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
       or (v_row.kind in ('D7', 'D3', 'D1', 'DDAY') and v_row.promise_status in ('CHECKING', 'DISPUTED'))
       or (v_row.kind = 'INVITE_EXPIRE_SOON' and v_row.promise_status <> 'PENDING')
       or (v_row.kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON') and v_row.promise_status <> 'DRAFT')
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
        v_event := 'NT-06'; v_days := v_row.end_date - v_kst_date;
      when 'DDAY' then
        v_event := 'NT-07'; v_days := case when v_row.end_date = v_kst_date then 1 else 0 end;
      when 'CHECK_REQ' then
        v_event := 'NT-08'; v_days := 1;
      when 'CHECK_R1', 'CHECK_R2' then
        v_event := 'NT-10';
        v_days := (v_row.check_deadline_at at time zone 'Asia/Seoul')::date - v_kst_date;
      when 'INVITE_EXPIRE_SOON' then
        v_event := 'NT-04'; v_days := 1;
      when 'AMEND_REMIND' then
        v_event := 'NT-15'; v_days := 1;
      when 'DRAFT_RESUME' then
        v_event := 'NT-20'; v_days := 1;
      when 'DRAFT_DELETE_SOON' then
        v_event := 'NT-21'; v_days := 1;
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
      jsonb_strip_nulls(jsonb_build_object(
        'promiseTitle', v_row.promise_title,
        'days', case when v_event in ('NT-06', 'NT-10') then v_days else null end,
        'partnerNickname', case when v_event = 'NT-15' then v_row.amend_requester_nickname else null end,
        'amendType', case when v_event = 'NT-15' then v_row.amend_type else null end
      )),
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

create or replace function public.lf_schedule_invitation_expiry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lf-j04-invitation-expiry-scheduler', 0));
  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;
  for v_job_id in select jobid from cron.job where jobname = 'lf-invitation-expiry' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule('lf-invitation-expiry', '*/30 * * * *', 'select public.lf_expire_invitations();');
end;
$$;

create or replace function public.lf_schedule_draft_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lf-j06-draft-cleanup-scheduler', 0));
  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;
  for v_job_id in select jobid from cron.job where jobname = 'lf-draft-cleanup' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule('lf-draft-cleanup', '0 19 * * *', 'select public.lf_prepare_draft_cleanup();');
end;
$$;

revoke all on function public.lf_expire_invitations(timestamptz, int) from public, anon, authenticated;
revoke all on function public.lf_prepare_draft_cleanup(timestamptz, int) from public, anon, authenticated;
revoke all on function public.lf_dispatch_due_reminders(timestamptz, int) from public, anon, authenticated;
revoke all on function public.lf_schedule_invitation_expiry() from public, anon, authenticated;
revoke all on function public.lf_schedule_draft_cleanup() from public, anon, authenticated;
grant execute on function public.lf_expire_invitations(timestamptz, int) to service_role;
grant execute on function public.lf_prepare_draft_cleanup(timestamptz, int) to service_role;
grant execute on function public.lf_dispatch_due_reminders(timestamptz, int) to service_role;
grant execute on function public.lf_schedule_invitation_expiry() to service_role;
grant execute on function public.lf_schedule_draft_cleanup() to service_role;

select public.lf_schedule_invitation_expiry();
select public.lf_schedule_draft_cleanup();
