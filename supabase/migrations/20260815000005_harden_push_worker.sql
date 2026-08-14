-- F-06 final hardening: transaction-coalesced nudge, payload quarantine, ordered aggregation.

update public.push_deliveries d
   set status = 'FAILED',
       lease_id = null,
       lease_expires_at = null,
       next_attempt_at = now(),
       last_error_code = 'PayloadInvalid',
       updated_at = now()
  from public.notifications n
 where n.id = d.notification_id
   and n.channel = 'PUSH'
   and (
     n.promise_id is null
     or n.deeplink is null
     or n.deeplink not in ('SCR-A03', 'SCR-A04', 'SCR-A05', 'SCR-A06')
   )
   and d.status not in ('DELIVERED', 'FAILED');

update public.notifications n
   set status = 'FAILED',
       fail_reason = 'PUSH_PAYLOAD_INVALID'
 where n.channel = 'PUSH'
   and (
     n.promise_id is null
     or n.deeplink is null
     or n.deeplink not in ('SCR-A03', 'SCR-A04', 'SCR-A05', 'SCR-A06')
   )
   and n.status = 'QUEUED';

-- 기존 잘못된 행은 위에서 격리하고, 새 쓰기부터 정확한 모바일 allowlist를 강제한다.
alter table public.notifications
  add constraint notifications_push_payload_shape check (
    channel <> 'PUSH'
    or (
      promise_id is not null
      and deeplink is not null
      and deeplink in ('SCR-A03', 'SCR-A04', 'SCR-A05', 'SCR-A06')
    )
  ) not valid;

create or replace function public.lf_nudge_push_send()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if current_setting('littlefinger.push_send_nudged', true) = '1' then
    return new;
  end if;
  perform set_config('littlefinger.push_send_nudged', '1', true);

  begin
    select decrypted_secret
      into v_url
      from vault.decrypted_secrets
     where name = 'push_send_url'
     limit 1;
    select decrypted_secret
      into v_secret
      from vault.decrypted_secrets
     where name = 'push_send_secret'
     limit 1;

    if nullif(v_url, '') is null or nullif(v_secret, '') is null then
      return new;
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-send-secret', v_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  exception when others then
    -- nudge는 지연 최적화라 실패해도 intent와 10분 복구 경로를 보존한다.
    null;
  end;

  return new;
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
  for v_id in
    select distinct id
      from unnest(coalesce(p_notification_ids, '{}'::uuid[])) id
     order by id
  loop
    perform 1
      from public.notifications n
     where n.id = v_id
       and n.channel = 'PUSH'
     for update;
    if not found then continue; end if;

    if exists (
      select 1 from public.push_deliveries d
       where d.notification_id = v_id and d.status = 'DELIVERED'
    ) then
      update public.notifications
         set status = 'SENT', sent_at = coalesce(sent_at, p_now), fail_reason = null
       where id = v_id;
      v_sent := v_sent + 1;
    elsif exists (
      select 1 from public.push_deliveries d where d.notification_id = v_id
    ) and not exists (
      select 1 from public.push_deliveries d
       where d.notification_id = v_id and d.status <> 'FAILED'
    ) then
      update public.notifications
         set status = 'FAILED', fail_reason = 'PUSH_DELIVERY_FAILED'
       where id = v_id;
      v_failed := v_failed + 1;
    else
      v_pending := v_pending + 1;
    end if;
  end loop;

  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'pending', v_pending);
end;
$$;

revoke all on function public.lf_nudge_push_send()
  from public, anon, authenticated, service_role;
revoke all on function public.lf_push_refresh_notification_status(uuid[], timestamptz)
  from public, anon, authenticated, service_role;
