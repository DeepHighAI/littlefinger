-- 알림 읽음 변경도 첫 성공 응답을 원자적으로 보존해 재시도에서 그대로 재생한다.

drop function public.lf_notification_read(uuid, uuid, timestamptz);
drop function public.lf_notification_read_all(uuid, timestamptz);

create function public.lf_notification_read(
  p_idempotency_key uuid,
  p_actor uuid,
  p_notification_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_read_at timestamptz;
  v_response jsonb;
begin
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'notification-read'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select n.read_at
    into v_read_at
    from public.notifications n
   where n.id = p_notification_id
     and n.user_id = p_actor
     and n.channel = 'INAPP'
     and n.created_at >= p_now - make_interval(days => public.lf_notification_retention_days())
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_read_at is null then
    update public.notifications
       set status = 'READ',
           read_at = p_now
     where id = p_notification_id
    returning read_at into v_read_at;
  end if;

  v_response := jsonb_build_object(
    'notification_id', p_notification_id,
    'read_at', v_read_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create function public.lf_notification_read_all(
  p_idempotency_key uuid,
  p_actor uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_read_count int;
  v_response jsonb;
begin
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'notification-read-all'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  update public.notifications n
     set status = 'READ',
         read_at = p_now
   where n.user_id = p_actor
     and n.channel = 'INAPP'
     and n.read_at is null
     and n.created_at >= p_now - make_interval(days => public.lf_notification_retention_days());

  get diagnostics v_read_count = row_count;
  v_response := jsonb_build_object('read_count', v_read_count);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_notification_read(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_notification_read_all(uuid, uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function public.lf_notification_read(uuid, uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.lf_notification_read_all(uuid, uuid, timestamptz)
  to service_role;
