-- F-06 fanout 동시성 보강 — 수신자 상태와 기기 집합을 한 번 잠가 같은 스냅샷으로 쓴다.

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
  v_token_ids uuid[] := '{}'::uuid[];
begin
  -- 상태 확인과 알림 쓰기 사이에 탈퇴·정지가 끼어들지 못하게 같은 사용자 행을 잡는다.
  perform 1
    from public.users u
   where u.id = p_user_id
     and u.status = 'ACTIVE'
   for share;
  if not found then
    raise exception 'E_FORBIDDEN';
  end if;

  -- 현재 토큰 ID를 한 번만 순서대로 캡처한다. 행 잠금은 삭제·재할당을 커밋 뒤로 미루고,
  -- 배열은 이후 새로 등록된 기기가 같은 논리 알림에 뒤늦게 합류하지 못하게 한다.
  select coalesce(array_agg(locked.id order by locked.id), '{}'::uuid[])
    into v_token_ids
    from (
      select dt.id
        from public.device_tokens dt
       where dt.user_id = p_user_id
       order by dt.id
       for share
    ) locked;

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

  if cardinality(v_token_ids) > 0 then
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
    select v_push_id, snapshot.device_token_id, p_now
      from unnest(v_token_ids) as snapshot(device_token_id);

    get diagnostics v_delivery_count = row_count;
  end if;

  return jsonb_build_object(
    'inapp_notification_id', v_inapp_id,
    'push_notification_id', v_push_id,
    'delivery_count', v_delivery_count
  );
end;
$$;

revoke all on function public.lf_notification_fanout(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.lf_notification_fanout(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) to service_role;

-- 같은 Expo 토큰이 다른 사용자에게 옮겨질 때 기존 delivery가 새 사용자를 가리키면 안 된다.
create or replace function public.lf_device_token_register(
  p_user_id uuid,
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(p_expo_push_token);
  v_token_id uuid;
  v_owner_id uuid;
begin
  perform public.lf_assert_actor(p_user_id);

  if nullif(v_token, '') is null then
    raise exception 'E_VALIDATION';
  end if;

  -- 로그인 시 드문 경로다. 테이블 단위 직렬화로 같은 UNIQUE 토큰의 교차 계정 등록이
  -- 서로의 DELETE/INSERT를 엇갈리게 실행하지 못하게 한다.
  lock table public.device_tokens in share row exclusive mode;

  select dt.id, dt.user_id
    into v_token_id, v_owner_id
    from public.device_tokens dt
   where dt.fcm_token = v_token
   for update;

  if v_token_id is null then
    insert into public.device_tokens (user_id, fcm_token, platform)
    values (p_user_id, v_token, 'ANDROID');
  elsif v_owner_id = p_user_id then
    update public.device_tokens
       set platform = 'ANDROID',
           last_seen_at = now()
     where id = v_token_id;
  else
    -- ON DELETE SET NULL이 이전 사용자의 대기 delivery를 새 사용자 토큰과 분리한다.
    delete from public.device_tokens where id = v_token_id;
    insert into public.device_tokens (user_id, fcm_token, platform)
    values (p_user_id, v_token, 'ANDROID');
  end if;

  delete from public.device_tokens
   where id in (
     select id
       from public.device_tokens
      where user_id = p_user_id
      order by last_seen_at desc, id desc
      offset 3
   );
end;
$$;

revoke all on function public.lf_device_token_register(uuid, text)
  from public, anon, authenticated;

grant execute on function public.lf_device_token_register(uuid, text)
  to service_role;
