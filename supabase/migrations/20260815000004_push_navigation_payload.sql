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

  update public.push_deliveries
     set status = case when expo_ticket_id is null
                       then 'RETRY'::public.push_delivery_status
                       else 'RECEIPT_PENDING'::public.push_delivery_status end,
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
           expo_push_token_snapshot = (
             select dt.fcm_token
               from public.device_tokens dt
               join public.notifications n on n.user_id = dt.user_id
              where dt.id = d.device_token_id
                and n.id = d.notification_id
           ),
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
        'promise_id', n.promise_id,
        'device_token_id', l.device_token_id,
        'expo_push_token', l.expo_push_token_snapshot,
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
    join public.notifications n on n.id = l.notification_id;

  return v_result;
end;
$$;
