-- F-09 본인 신뢰 프로필, 리마인드 설정, 현재 기기 해제와 J-10 보정 경계.

create or replace function public.lf_my_trust_profile(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  select pg_catalog.jsonb_build_object(
           'nickname', u.nickname,
           'profile_image_url', u.profile_image_url,
           'keep_rate', tp.keep_rate,
           'completed_count', coalesce(tp.completed_count, 0),
           'broken_count', coalesce(tp.broken_count, 0),
           'disputed_count', coalesce(tp.disputed_count, 0),
           'unresolved_count', coalesce(tp.unresolved_count, 0),
           'active_count', coalesce(tp.active_count, 0),
           'updated_at', coalesce(tp.updated_at, u.updated_at),
           'reminders', pg_catalog.jsonb_build_object(
             'remind_d7', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d7') = 'boolean'
                 then (u.notification_pref->>'remind_d7')::boolean
               else true
             end,
             'remind_d3', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d3') = 'boolean'
                 then (u.notification_pref->>'remind_d3')::boolean
               else true
             end,
             'remind_d1', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_d1') = 'boolean'
                 then (u.notification_pref->>'remind_d1')::boolean
               else true
             end,
             'remind_dday', case
               when pg_catalog.jsonb_typeof(u.notification_pref->'remind_dday') = 'boolean'
                 then (u.notification_pref->>'remind_dday')::boolean
               else true
             end,
             'remind_hour', case
               when u.notification_pref->>'remind_hour' in ('09', '12', '20')
                 then u.notification_pref->>'remind_hour'
               else '09'
             end
           )
         )
    into v_response
    from public.users u
    left join public.trust_profiles tp on tp.user_id = u.id
   where u.id = p_actor;

  return v_response;
end;
$$;

create or replace function public.lf_trust_profile_settings_update(
  p_idempotency_key uuid,
  p_actor uuid,
  p_reminders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_pref jsonb;
  v_status public.user_status;
  v_updated_at timestamptz;
  v_response jsonb;
begin
  select u.status, u.notification_pref
    into v_status, v_pref
    from public.users u
   where u.id = p_actor
   for update;

  if not found then
    raise exception 'E_AUTH_REQUIRED';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'E_FORBIDDEN';
  end if;

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'trust-profile-settings-update'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  if pg_catalog.jsonb_typeof(p_reminders) is distinct from 'object'
     or not p_reminders ?& array[
       'remind_d7', 'remind_d3', 'remind_d1', 'remind_dday', 'remind_hour'
     ]
     or (select count(*) from pg_catalog.jsonb_object_keys(p_reminders)) <> 5
     or pg_catalog.jsonb_typeof(p_reminders->'remind_d7') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(p_reminders->'remind_d3') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(p_reminders->'remind_d1') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(p_reminders->'remind_dday') is distinct from 'boolean'
    or pg_catalog.jsonb_typeof(p_reminders->'remind_hour') is distinct from 'string'
    or p_reminders->>'remind_hour' not in ('09', '12', '20')
  then
    raise exception 'E_VALIDATION';
  end if;

  v_updated_at := now();
  v_pref := (
    coalesce(v_pref, '{}'::jsonb)
      - 'remind_d7'
      - 'remind_d3'
      - 'remind_d1'
      - 'remind_dday'
      - 'remind_hour'
  ) || p_reminders;

  update public.users
     set notification_pref = v_pref,
         updated_at = v_updated_at
   where id = p_actor;

  update public.reminder_schedules rs
     set fire_at = (
       (
         p.end_date
         - case rs.kind
             when 'D7' then 7
             when 'D3' then 3
             when 'D1' then 1
             else 0
           end
       )::timestamp
       + pg_catalog.make_interval(hours => (p_reminders->>'remind_hour')::int)
     ) at time zone 'Asia/Seoul'
    from public.promises p
   where rs.promise_id = p.id
     and rs.user_id = p_actor
     and rs.status = 'PENDING'
     and rs.kind in ('D7', 'D3', 'D1', 'DDAY');

  v_response := pg_catalog.jsonb_build_object(
    'reminders', p_reminders,
    'updated_at', v_updated_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_device_token_unregister(
  p_idempotency_key uuid,
  p_actor uuid,
  p_expo_push_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_removed int;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'device-token-unregister'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  if nullif(pg_catalog.btrim(p_expo_push_token), '') is null then
    raise exception 'E_VALIDATION';
  end if;

  delete from public.device_tokens
   where user_id = p_actor
     and fcm_token = pg_catalog.btrim(p_expo_push_token);
  get diagnostics v_removed = row_count;

  v_response := pg_catalog.jsonb_build_object('removed', v_removed > 0);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_recompute_all_trust_profiles()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_processed_count int := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j10-trust-profile', 0)
  );

  for v_user_id in
    select u.id
      from public.users u
     where u.status = 'ACTIVE'
     order by u.id
  loop
    perform public.lf_recompute_trust_profile(v_user_id);
    v_processed_count := v_processed_count + 1;
  end loop;

  return pg_catalog.jsonb_build_object('processed_count', v_processed_count);
end;
$$;

revoke all on function public.lf_my_trust_profile(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_trust_profile_settings_update(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.lf_device_token_unregister(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.lf_recompute_all_trust_profiles()
  from public, anon, authenticated;

grant execute on function public.lf_my_trust_profile(uuid) to service_role;
grant execute on function public.lf_trust_profile_settings_update(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.lf_device_token_unregister(uuid, uuid, text)
  to service_role;
grant execute on function public.lf_recompute_all_trust_profiles()
  to service_role;
