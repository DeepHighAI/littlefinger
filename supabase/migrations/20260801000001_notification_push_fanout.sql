-- F-06 알림 fanout — 논리 알림 한 건을 INAPP, PUSH, 기기별 delivery로 원자적으로 펼친다.

create type public.push_delivery_status as enum (
  'QUEUED',
  'LEASED',
  'RECEIPT_PENDING',
  'RETRY',
  'DELIVERED',
  'FAILED'
);

-- server-only: push_deliveries
-- Expo 토큰 자체는 device_tokens 한 곳에만 두고, 큐는 그 행의 식별자만 보관한다.
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications (id) on delete cascade,
  device_token_id uuid
    references public.device_tokens (id) on delete set null,
  status public.push_delivery_status not null default 'QUEUED',
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  expo_ticket_id text,
  ticketed_at timestamptz,
  receipt_checked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index push_deliveries_notification_token_uidx
  on public.push_deliveries (notification_id, device_token_id)
  where device_token_id is not null;

create unique index push_deliveries_expo_ticket_uidx
  on public.push_deliveries (expo_ticket_id)
  where expo_ticket_id is not null;

create index push_deliveries_due_idx
  on public.push_deliveries (status, next_attempt_at);

alter table public.push_deliveries enable row level security;

revoke all on table public.push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.push_deliveries to service_role;

create or replace function public.lf_notification_fanout(
  p_user_id uuid,
  p_promise_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_deeplink text,
  p_inapp_dedupe_key text,
  p_push_dedupe_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inapp_id uuid;
  v_push_id uuid;
  v_delivery_count int := 0;
begin
  if not exists (
    select 1
      from public.users u
     where u.id = p_user_id
       and u.status = 'ACTIVE'
  ) then
    raise exception 'E_FORBIDDEN';
  end if;

  -- INAPP 행의 INSERT 승자가 그 시점의 토큰 집합까지 고정한다. 재시도 때 새 토큰을
  -- 끼워 넣으면 같은 논리 이벤트의 수신 기기가 실행 시점에 따라 달라진다.
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
    sent_at
  )
  values (
    p_user_id,
    p_promise_id,
    p_type,
    'INAPP',
    p_title,
    p_body,
    p_deeplink,
    'SENT',
    p_inapp_dedupe_key,
    p_now
  )
  on conflict (dedupe_key) do nothing
  returning id into v_inapp_id;

  if v_inapp_id is null then
    select n.id
      into v_inapp_id
      from public.notifications n
     where n.dedupe_key = p_inapp_dedupe_key;

    select n.id
      into v_push_id
      from public.notifications n
     where n.dedupe_key = p_push_dedupe_key;

    if v_push_id is not null then
      select count(*)::int
        into v_delivery_count
        from public.push_deliveries d
       where d.notification_id = v_push_id;
    end if;

    return jsonb_build_object(
      'inapp_notification_id', v_inapp_id,
      'push_notification_id', v_push_id,
      'delivery_count', v_delivery_count
    );
  end if;

  if exists (select 1 from public.device_tokens dt where dt.user_id = p_user_id) then
    insert into public.notifications (
      user_id,
      promise_id,
      type,
      channel,
      title,
      body,
      deeplink,
      status,
      dedupe_key
    )
    values (
      p_user_id,
      p_promise_id,
      p_type,
      'PUSH',
      p_title,
      p_body,
      p_deeplink,
      'QUEUED',
      p_push_dedupe_key
    )
    returning id into v_push_id;

    insert into public.push_deliveries (
      notification_id,
      device_token_id,
      next_attempt_at
    )
    select v_push_id, dt.id, p_now
      from public.device_tokens dt
     where dt.user_id = p_user_id;

    get diagnostics v_delivery_count = row_count;
  end if;

  return jsonb_build_object(
    'inapp_notification_id', v_inapp_id,
    'push_notification_id', v_push_id,
    'delivery_count', v_delivery_count
  );
end;
$$;

comment on function public.lf_notification_fanout(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) is
  '논리 알림을 즉시 SENT INAPP과 현재 기기별 PUSH delivery로 원자적으로 펼친다(F-06).';

revoke all on function public.lf_notification_fanout(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.lf_notification_fanout(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) to service_role;
