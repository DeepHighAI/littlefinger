-- SCR-A07 알림함 — 사용자별 INAPP 조회·읽음 상태와 90일 보존 정리.

create or replace function public.lf_notification_retention_days()
returns int
language sql
immutable
set search_path = ''
as $$
  select 90;
$$;

create or replace function public.lf_notification_inbox_list(
  p_actor uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_notification_id uuid default null,
  p_limit int default 20,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_items jsonb;
  v_unread_count int;
  v_next_cursor jsonb;
begin
  if p_actor is null then
    raise exception 'E_AUTH_REQUIRED';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_notification_id is null) then
    raise exception 'E_VALIDATION';
  end if;

  with eligible as materialized (
    select n.id,
           n.promise_id,
           n.type,
           n.title,
           n.body,
           n.deeplink,
           n.created_at,
           n.read_at
      from public.notifications n
     where n.user_id = p_actor
       and n.channel = 'INAPP'
       and n.created_at >= p_now - make_interval(days => public.lf_notification_retention_days())
       and (
         p_cursor_created_at is null
         or (n.created_at, n.id) < (p_cursor_created_at, p_cursor_notification_id)
       )
  ), bounded as materialized (
    select *
      from eligible
     order by created_at desc, id desc
     limit v_limit + 1
  ), page as materialized (
    select *
      from bounded
     order by created_at desc, id desc
     limit v_limit
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'notification_id', page.id,
               'promise_id', page.promise_id,
               'event', page.type,
               'title', page.title,
               'body', page.body,
               'deeplink', page.deeplink,
               'created_at', page.created_at,
               'read_at', page.read_at
             )
             order by page.created_at desc, page.id desc
           ),
           '[]'::jsonb
         ),
         (select count(*)::int from public.notifications n
           where n.user_id = p_actor
             and n.channel = 'INAPP'
             and n.read_at is null
             and n.created_at >= p_now - make_interval(days => public.lf_notification_retention_days())),
         case when exists (select 1 from bounded offset v_limit) then (
           select jsonb_build_object('created_at', tail.created_at, 'notification_id', tail.id)
             from page tail
            order by tail.created_at asc, tail.id asc
            limit 1
         ) else null end
    into v_items, v_unread_count, v_next_cursor
    from page;

  return jsonb_build_object(
    'items', v_items,
    'unread_count', v_unread_count,
    'next_cursor', v_next_cursor
  );
end;
$$;

create or replace function public.lf_notification_read(
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
  v_read_at timestamptz;
begin
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

  return jsonb_build_object(
    'notification_id', p_notification_id,
    'read_at', v_read_at
  );
end;
$$;

create or replace function public.lf_notification_read_all(
  p_actor uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_read_count int;
begin
  update public.notifications n
     set status = 'READ',
         read_at = p_now
   where n.user_id = p_actor
     and n.channel = 'INAPP'
     and n.read_at is null
     and n.created_at >= p_now - make_interval(days => public.lf_notification_retention_days());

  get diagnostics v_read_count = row_count;
  return jsonb_build_object('read_count', v_read_count);
end;
$$;

create or replace function public.lf_notification_retention_purge(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
begin
  delete from public.notifications n
   where n.created_at < p_now - make_interval(days => public.lf_notification_retention_days());

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.lf_schedule_notification_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;

  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'lf-notification-retention'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'lf-notification-retention',
    '20 19 * * *',
    'select public.lf_notification_retention_purge();'
  );
end;
$$;

revoke all on function public.lf_notification_retention_days() from public, anon, authenticated;
revoke all on function public.lf_notification_inbox_list(uuid, timestamptz, uuid, int, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_notification_read(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_notification_read_all(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_notification_retention_purge(timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_schedule_notification_retention()
  from public, anon, authenticated;

grant execute on function public.lf_notification_inbox_list(uuid, timestamptz, uuid, int, timestamptz)
  to service_role;
grant execute on function public.lf_notification_read(uuid, uuid, timestamptz) to service_role;
grant execute on function public.lf_notification_read_all(uuid, timestamptz) to service_role;
grant execute on function public.lf_notification_retention_purge(timestamptz) to service_role;
grant execute on function public.lf_schedule_notification_retention() to service_role;

select public.lf_schedule_notification_retention();
