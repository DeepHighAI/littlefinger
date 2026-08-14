-- F-06 Expo push worker — lease fencing, bounded send retries, and receipt aggregation.

alter table public.push_deliveries
  add column lease_id uuid;

-- 이전 worker 구현은 없었으므로 남은 LEASED 행은 새 fencing 계약으로 다시 시작한다.
update public.push_deliveries
   set status = case when expo_ticket_id is null then 'RETRY'::public.push_delivery_status else 'RECEIPT_PENDING'::public.push_delivery_status end,
       lease_expires_at = null
 where status = 'LEASED';

alter table public.push_deliveries
  add constraint push_deliveries_lease_shape check (
    (status = 'LEASED' and lease_id is not null and lease_expires_at is not null)
    or
    (status <> 'LEASED' and lease_id is null and lease_expires_at is null)
  );

revoke all on table public.push_deliveries from service_role;

create or replace function public.lf_push_claim_deliveries(
  p_now timestamptz default now(),
  p_limit int default 500,
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
  if p_limit < 0 or p_limit > 500 or p_lease_seconds < 1 then
    raise exception 'E_VALIDATION';
  end if;

  -- claim 뒤 HTTP 전에 죽은 worker는 Expo 시도를 하지 않았으므로 attempt_count를 보존한다.
  update public.push_deliveries
     set status = case when expo_ticket_id is null then 'RETRY'::public.push_delivery_status else 'RECEIPT_PENDING'::public.push_delivery_status end,
         next_attempt_at = p_now,
         lease_id = null,
         lease_expires_at = null,
         updated_at = p_now
   where status = 'LEASED'
     and lease_expires_at <= p_now;

  with candidates as (
    select d.id
      from public.push_deliveries d
     where d.status in ('QUEUED', 'RETRY')
       and d.expo_ticket_id is null
       and d.attempt_count < 4
       and d.next_attempt_at <= p_now
     order by d.next_attempt_at, d.created_at, d.id
     limit p_limit
     for update skip locked
  ), leased as (
    update public.push_deliveries d
       set status = 'LEASED',
           lease_id = gen_random_uuid(),
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      from candidates c
     where d.id = c.id
    returning d.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'notification_id', l.notification_id,
        'device_token_id', l.device_token_id,
        'expo_push_token', dt.fcm_token,
        'title', n.title,
        'body', n.body,
        'deeplink', n.deeplink,
        'attempt_count', l.attempt_count,
        'lease_id', l.lease_id
      ) order by l.next_attempt_at, l.created_at, l.id
    ),
    '[]'::jsonb
  )
    into v_result
    from leased l
    join public.notifications n on n.id = l.notification_id
    left join public.device_tokens dt
      on dt.id = l.device_token_id
     and dt.user_id = n.user_id;

  return v_result;
end;
$$;

create or replace function public.lf_push_record_tickets(
  p_results jsonb,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_input jsonb;
  v_row public.push_deliveries%rowtype;
  v_attempted boolean;
  v_attempts int;
  v_outcome text;
  v_error text;
  v_accepted int := 0;
  v_ignored int := 0;
  v_ticketed int := 0;
  v_retried int := 0;
  v_failed int := 0;
  v_notification_ids uuid[] := '{}'::uuid[];
begin
  if jsonb_typeof(p_results) <> 'array' then raise exception 'E_VALIDATION'; end if;

  for v_input in select value from jsonb_array_elements(p_results)
  loop
    select * into v_row
      from public.push_deliveries d
     where d.id = (v_input ->> 'delivery_id')::uuid
       and d.status = 'LEASED'
       and d.lease_id = (v_input ->> 'lease_id')::uuid
     for update;

    if not found then
      v_ignored := v_ignored + 1;
      continue;
    end if;

    v_outcome := v_input ->> 'outcome';
    v_attempted := coalesce((v_input ->> 'attempted')::boolean, false);
    v_attempts := v_row.attempt_count + case when v_attempted then 1 else 0 end;
    v_error := nullif(v_input ->> 'error_code', '');

    if v_outcome = 'ticket' and v_attempted and nullif(v_input ->> 'expo_ticket_id', '') is not null then
      update public.push_deliveries
         set status = 'RECEIPT_PENDING',
             attempt_count = v_attempts,
             expo_ticket_id = v_input ->> 'expo_ticket_id',
             ticketed_at = p_now,
             next_attempt_at = p_now + interval '15 minutes',
             lease_id = null,
             lease_expires_at = null,
             last_error_code = null,
             updated_at = p_now
       where id = v_row.id;
      v_ticketed := v_ticketed + 1;
    elsif v_outcome = 'retry' and v_attempted and v_attempts < 4 then
      update public.push_deliveries
         set status = 'RETRY',
             attempt_count = v_attempts,
             next_attempt_at = p_now + make_interval(secs => case v_attempts
               when 1 then 60 when 2 then 300 when 3 then 900 end),
             lease_id = null,
             lease_expires_at = null,
             last_error_code = coalesce(v_error, 'ExpoSendRetry'),
             updated_at = p_now
       where id = v_row.id;
      v_retried := v_retried + 1;
    elsif v_outcome in ('retry', 'failed') then
      update public.push_deliveries
         set status = 'FAILED',
             attempt_count = v_attempts,
             next_attempt_at = p_now,
             lease_id = null,
             lease_expires_at = null,
             last_error_code = case
               when v_outcome = 'retry' and v_attempts >= 4 then 'MaxSendAttemptsExceeded'
               else coalesce(v_error, 'ExpoSendFailed')
             end,
             updated_at = p_now
       where id = v_row.id;
      v_failed := v_failed + 1;
    else
      raise exception 'E_VALIDATION';
    end if;

    if v_error = 'DeviceNotRegistered' then
      -- ID·원문 토큰·알림 수신자까지 모두 같아야 현재 기기를 지운다. 재할당 행은 보존한다.
      delete from public.device_tokens dt
       using public.notifications n
       where n.id = v_row.notification_id
         and dt.id = v_row.device_token_id
         and dt.id = nullif(v_input ->> 'device_token_id', '')::uuid
         and dt.fcm_token = v_input ->> 'expo_push_token'
         and dt.user_id = n.user_id;
    end if;

    v_accepted := v_accepted + 1;
    v_notification_ids := array_append(v_notification_ids, v_row.notification_id);
  end loop;

  return jsonb_build_object(
    'accepted', v_accepted,
    'ignored', v_ignored,
    'ticketed', v_ticketed,
    'retried', v_retried,
    'failed', v_failed,
    'notification_ids', to_jsonb((select array_agg(distinct x) from unnest(v_notification_ids) x))
  );
end;
$$;

create or replace function public.lf_push_claim_receipts(
  p_now timestamptz default now(),
  p_limit int default 1000,
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
  if p_limit < 0 or p_limit > 1000 or p_lease_seconds < 1 then raise exception 'E_VALIDATION'; end if;

  update public.push_deliveries
     set status = case when expo_ticket_id is null then 'RETRY'::public.push_delivery_status else 'RECEIPT_PENDING'::public.push_delivery_status end,
         next_attempt_at = p_now,
         lease_id = null,
         lease_expires_at = null,
         updated_at = p_now
   where status = 'LEASED' and lease_expires_at <= p_now;

  with candidates as (
    select d.id
      from public.push_deliveries d
     where d.status = 'RECEIPT_PENDING'
       and d.expo_ticket_id is not null
       and d.ticketed_at is not null
       and d.next_attempt_at <= p_now
       and d.ticketed_at + interval '15 minutes' <= p_now
     order by d.next_attempt_at, d.created_at, d.id
     limit p_limit
     for update skip locked
  ), leased as (
    update public.push_deliveries d
       set status = 'LEASED',
           lease_id = gen_random_uuid(),
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      from candidates c where d.id = c.id
    returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'notification_id', l.notification_id,
    'device_token_id', l.device_token_id,
    'expo_ticket_id', l.expo_ticket_id,
    'lease_id', l.lease_id
  ) order by l.next_attempt_at, l.created_at, l.id), '[]'::jsonb)
    into v_result from leased l;
  return v_result;
end;
$$;

create or replace function public.lf_push_record_receipts(
  p_results jsonb,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_input jsonb;
  v_row public.push_deliveries%rowtype;
  v_outcome text;
  v_error text;
  v_accepted int := 0;
  v_ignored int := 0;
  v_delivered int := 0;
  v_retried int := 0;
  v_failed int := 0;
  v_notification_ids uuid[] := '{}'::uuid[];
begin
  if jsonb_typeof(p_results) <> 'array' then raise exception 'E_VALIDATION'; end if;

  for v_input in select value from jsonb_array_elements(p_results)
  loop
    select * into v_row
      from public.push_deliveries d
     where d.id = (v_input ->> 'delivery_id')::uuid
       and d.status = 'LEASED'
       and d.lease_id = (v_input ->> 'lease_id')::uuid
       and d.expo_ticket_id = v_input ->> 'expo_ticket_id'
     for update;
    if not found then v_ignored := v_ignored + 1; continue; end if;

    v_outcome := v_input ->> 'outcome';
    v_error := nullif(v_input ->> 'error_code', '');
    if v_outcome = 'delivered' then
      update public.push_deliveries set status = 'DELIVERED', receipt_checked_at = p_now,
        lease_id = null, lease_expires_at = null, last_error_code = null, updated_at = p_now
       where id = v_row.id;
      v_delivered := v_delivered + 1;
    elsif v_outcome = 'retry' then
      update public.push_deliveries set status = 'RECEIPT_PENDING', receipt_checked_at = p_now,
        next_attempt_at = p_now + interval '60 seconds', lease_id = null, lease_expires_at = null,
        last_error_code = coalesce(v_error, 'ExpoReceiptRetry'), updated_at = p_now
       where id = v_row.id;
      v_retried := v_retried + 1;
    elsif v_outcome = 'failed' then
      update public.push_deliveries set status = 'FAILED', receipt_checked_at = p_now,
        lease_id = null, lease_expires_at = null,
        last_error_code = coalesce(v_error, 'ExpoReceiptFailed'), updated_at = p_now
       where id = v_row.id;
      v_failed := v_failed + 1;
    else
      raise exception 'E_VALIDATION';
    end if;

    if v_error = 'DeviceNotRegistered' then
      delete from public.device_tokens dt
       using public.notifications n
       where n.id = v_row.notification_id
         and dt.id = v_row.device_token_id
         and dt.user_id = n.user_id;
    end if;
    v_accepted := v_accepted + 1;
    v_notification_ids := array_append(v_notification_ids, v_row.notification_id);
  end loop;

  return jsonb_build_object(
    'accepted', v_accepted, 'ignored', v_ignored, 'delivered', v_delivered,
    'retried', v_retried, 'failed', v_failed,
    'notification_ids', to_jsonb((select array_agg(distinct x) from unnest(v_notification_ids) x))
  );
end;
$$;

create or replace function public.lf_push_refresh_notification_status(
  p_notification_ids uuid[],
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_sent int := 0;
  v_failed int := 0;
  v_pending int := 0;
begin
  for v_id in select distinct id from unnest(coalesce(p_notification_ids, '{}'::uuid[])) id
  loop
    perform 1 from public.notifications n where n.id = v_id and n.channel = 'PUSH' for update;
    if not found then continue; end if;

    if exists (select 1 from public.push_deliveries d where d.notification_id = v_id and d.status = 'DELIVERED') then
      update public.notifications set status = 'SENT', sent_at = coalesce(sent_at, p_now), fail_reason = null where id = v_id;
      v_sent := v_sent + 1;
    elsif exists (select 1 from public.push_deliveries d where d.notification_id = v_id)
      and not exists (select 1 from public.push_deliveries d where d.notification_id = v_id and d.status <> 'FAILED') then
      update public.notifications set status = 'FAILED', fail_reason = 'PUSH_DELIVERY_FAILED' where id = v_id;
      v_failed := v_failed + 1;
    else
      v_pending := v_pending + 1;
    end if;
  end loop;
  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'pending', v_pending);
end;
$$;

revoke all on function public.lf_push_claim_deliveries(timestamptz, int, int) from public, anon, authenticated;
revoke all on function public.lf_push_record_tickets(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.lf_push_claim_receipts(timestamptz, int, int) from public, anon, authenticated;
revoke all on function public.lf_push_record_receipts(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.lf_push_refresh_notification_status(uuid[], timestamptz) from public, anon, authenticated;

grant execute on function public.lf_push_claim_deliveries(timestamptz, int, int) to service_role;
grant execute on function public.lf_push_record_tickets(jsonb, timestamptz) to service_role;
grant execute on function public.lf_push_claim_receipts(timestamptz, int, int) to service_role;
grant execute on function public.lf_push_record_receipts(jsonb, timestamptz) to service_role;
grant execute on function public.lf_push_refresh_notification_status(uuid[], timestamptz) to service_role;
