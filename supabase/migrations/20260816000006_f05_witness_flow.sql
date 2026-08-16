-- F-05 증인 초대·참여·열람·확인 서명.
-- 토큰 원문은 Edge Function에만 머물고 DB에는 해시와 슬롯 연결만 보존한다.

alter table public.promise_participants
  add column invitation_id uuid references public.invitations (id);

create unique index promise_participants_unique_invitation
  on public.promise_participants (invitation_id)
  where invitation_id is not null;

create unique index approvals_unique_witness_sign
  on public.approvals (promise_id, user_id)
  where action = 'WITNESS_SIGN';

alter table public.notification_outbox
  drop constraint notification_outbox_event_check;

alter table public.notification_outbox
  add constraint notification_outbox_event_check check (
    event in (
      'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05', 'NT-06', 'NT-07',
      'NT-08', 'NT-09', 'NT-10', 'NT-11', 'NT-12', 'NT-13', 'NT-14', 'NT-18', 'NT-19'
    )
  );

create or replace function public.lf_witness_invite_list(
  p_actor uuid,
  p_promise_id uuid
)
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

  if not exists (
    select 1
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.user_id = p_actor
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED'
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'occupied_count', count(*)::int,
           'capacity', 2,
           'witnesses', coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'participant_id', q.participant_id,
                 'status', q.status,
                 'nickname', q.nickname,
                 'profile_image_url', q.profile_image_url,
                 'expires_at', q.expires_at,
                 'signed_at', q.signed_at
               ) order by q.invited_at, q.participant_id
             ),
             '[]'::jsonb
           )
         )
    into v_response
    from (
      select pp.id as participant_id,
             pp.status,
             u.nickname,
             u.profile_image_url,
             null::timestamptz as expires_at,
             (
               select a.acted_at
                 from public.approvals a
                where a.promise_id = pp.promise_id
                  and a.user_id = pp.user_id
                  and a.action = 'WITNESS_SIGN'
                order by a.acted_at, a.id
                limit 1
             ) as signed_at,
             pp.invited_at
        from public.promise_participants pp
        join public.users u on u.id = pp.user_id
       where pp.promise_id = p_promise_id
         and pp.role = 'WITNESS'
         and pp.status = 'JOINED'
      union all
      select pp.id,
             pp.status,
             null::varchar,
             null::text,
             i.expires_at,
             null::timestamptz,
             pp.invited_at
        from public.promise_participants pp
        join public.invitations i on i.id = pp.invitation_id
       where pp.promise_id = p_promise_id
         and pp.role = 'WITNESS'
         and pp.status = 'INVITED'
         and pp.user_id is null
         and i.status = 'PENDING'
         and i.expires_at > now()
    ) q;

  return v_response;
end;
$$;

create or replace function public.lf_witness_invite(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_token_hash char(64),
  p_participant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_promise public.promises%rowtype;
  v_participant public.promise_participants%rowtype;
  v_previous public.invitations%rowtype;
  v_invitation_id uuid;
  v_participant_id uuid;
  v_expires_at timestamptz;
  v_resend_count int := 0;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-invite');
  if v_cached is not null then
    return v_cached;
  end if;

  select * into v_promise
    from public.promises
   where id = p_promise_id
   for update;

  if not found or not exists (
    select 1
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.user_id = p_actor
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED'
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_promise.status not in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING') then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if p_participant_id is null then
    if (
      select count(*)
        from public.promise_participants pp
        left join public.invitations i on i.id = pp.invitation_id
       where pp.promise_id = p_promise_id
         and pp.role = 'WITNESS'
         and (
           pp.status = 'JOINED'
           or (
             pp.status = 'INVITED'
             and pp.user_id is null
             and i.status = 'PENDING'
             and i.expires_at > now()
           )
         )
    ) >= 2 then
      raise exception 'E_WITNESS_LIMIT';
    end if;
  else
    select * into v_participant
      from public.promise_participants
     where id = p_participant_id
       and promise_id = p_promise_id
       and role = 'WITNESS'
       and status = 'INVITED'
       and user_id is null
     for update;

    if not found or v_participant.invitation_id is null then
      raise exception 'E_NOT_FOUND';
    end if;

    select * into strict v_previous
      from public.invitations
     where id = v_participant.invitation_id
     for update;

    v_resend_count := v_previous.resend_count + 1;
    if v_resend_count > public.lf_invite_resend_max() then
      raise exception 'E_RATE_LIMIT';
    end if;

    update public.invitations
       set status = 'REVOKED'
     where id = v_previous.id
       and status in ('PENDING', 'EXPIRED');
  end if;

  v_expires_at := now() + make_interval(hours => public.lf_invite_ttl_hours());
  insert into public.invitations (
    promise_id, target_role, token_hash, created_by, expires_at, status,
    resend_count, parent_invitation_id
  ) values (
    p_promise_id, 'WITNESS', p_token_hash, p_actor, v_expires_at, 'PENDING',
    v_resend_count, case when p_participant_id is null then null else v_previous.id end
  ) returning id into v_invitation_id;

  if p_participant_id is null then
    insert into public.promise_participants (
      promise_id, role, status, invited_at, invitation_id
    ) values (
      p_promise_id, 'WITNESS', 'INVITED', now(), v_invitation_id
    ) returning id into v_participant_id;
  else
    update public.promise_participants
       set invitation_id = v_invitation_id,
           invited_at = now()
     where id = p_participant_id
    returning id into v_participant_id;
  end if;

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'participant_id', v_participant_id,
    'invitation_id', v_invitation_id,
    'title', v_promise.title,
    'expires_at', v_expires_at,
    'token_hash', p_token_hash
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_witness_join(
  p_idempotency_key uuid,
  p_actor uuid,
  p_token_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_invitation public.invitations%rowtype;
  v_promise public.promises%rowtype;
  v_participant_id uuid;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-join');
  if v_cached is not null then
    return v_cached;
  end if;

  select * into v_invitation
    from public.invitations
   where token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_invitation.status = 'REVOKED' then
    raise exception 'E_INVITE_REVOKED';
  end if;
  if v_invitation.status = 'USED' then
    raise exception 'E_INVITE_USED';
  end if;
  if v_invitation.status = 'EXPIRED' or v_invitation.expires_at <= now() then
    raise exception 'E_INVITE_EXPIRED';
  end if;
  if v_invitation.target_role <> 'WITNESS' then
    raise exception 'E_FORBIDDEN';
  end if;

  select * into strict v_promise
    from public.promises
   where id = v_invitation.promise_id
   for update;

  if exists (
    select 1
      from public.promise_participants pp
     where pp.promise_id = v_promise.id
       and pp.user_id = p_actor
  ) then
    raise exception 'E_DUPLICATE_ROLE';
  end if;

  if exists (
    select 1
      from public.blocks b
      join public.promise_participants pp
        on pp.promise_id = v_promise.id
       and pp.user_id is not null
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED'
     where (b.blocker_id = p_actor and b.blocked_user_id = pp.user_id)
        or (b.blocker_id = pp.user_id and b.blocked_user_id = p_actor)
  ) then
    raise exception 'E_BLOCKED';
  end if;

  update public.promise_participants
     set user_id = p_actor,
         status = 'JOINED',
         joined_at = now()
   where invitation_id = v_invitation.id
     and promise_id = v_promise.id
     and role = 'WITNESS'
     and status = 'INVITED'
     and user_id is null
  returning id into v_participant_id;

  if v_participant_id is null then
    raise exception 'E_INVITE_USED';
  end if;

  update public.invitations
     set status = 'USED',
         used_by = p_actor,
         used_at = now()
   where id = v_invitation.id
     and status = 'PENDING';

  if not found then
    raise exception 'E_INVITE_USED';
  end if;

  v_response := jsonb_build_object(
    'promise_id', v_promise.id,
    'participant_id', v_participant_id,
    'status', 'JOINED'
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_witness_detail(
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_promise public.promises%rowtype;
  v_version public.promise_versions%rowtype;
  v_creator jsonb;
  v_partner jsonb;
  v_signed_at timestamptz;
  v_fulfillment jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  if not exists (
    select 1
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.user_id = p_actor
       and pp.role = 'WITNESS'
       and pp.status = 'JOINED'
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  select * into strict v_promise
    from public.promises
   where id = p_promise_id;

  select jsonb_build_object(
           'user_id', u.id,
           'nickname', u.nickname,
           'profile_image_url', u.profile_image_url
         )
    into v_creator
    from public.users u
   where u.id = v_promise.creator_id;

  select jsonb_build_object(
           'user_id', u.id,
           'nickname', u.nickname,
           'profile_image_url', u.profile_image_url
         )
    into v_partner
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.role = 'PARTNER'
     and pp.status = 'JOINED';

  if v_promise.current_version_id is null or v_promise.activated_at is null or v_partner is null then
    return jsonb_build_object(
      'promise_id', v_promise.id,
      'status', v_promise.status,
      'visibility', 'LIMITED',
      'title', v_promise.title,
      'creator', v_creator,
      'partner', null,
      'activated_at', null,
      'signed_at', null,
      'content', null,
      'fulfillment', null
    );
  end if;

  select * into strict v_version
    from public.promise_versions
   where id = v_promise.current_version_id
     and promise_id = v_promise.id;

  select a.acted_at into v_signed_at
    from public.approvals a
   where a.promise_id = p_promise_id
     and a.user_id = p_actor
     and a.action = 'WITNESS_SIGN'
   order by a.acted_at, a.id
   limit 1;

  if v_promise.status in ('COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED') then
    select jsonb_build_object(
             'round_no', v_promise.check_round_no,
             'claims', coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'role', pp.role,
                   'answer', fc.answer,
                   'comment', fc.comment,
                   'submitted_at', fc.submitted_at,
                   'evidences', public.lf_fulfillment_evidence_views(fc.id)
                 ) order by pp.role
               ) filter (where fc.id is not null),
               '[]'::jsonb
             )
           )
      into v_fulfillment
      from public.fulfillment_checks fc
      join public.promise_participants pp
        on pp.promise_id = fc.promise_id
       and pp.user_id = fc.user_id
       and pp.role in ('CREATOR', 'PARTNER')
     where fc.promise_id = p_promise_id
       and fc.round_no = v_promise.check_round_no;
  end if;

  return jsonb_build_object(
    'promise_id', v_promise.id,
    'status', v_promise.status,
    'visibility', 'FULL',
    'title', v_version.title,
    'creator', v_creator,
    'partner', v_partner,
    'activated_at', v_promise.activated_at,
    'signed_at', v_signed_at,
    'content', jsonb_build_object(
      'body', v_version.body,
      'category', v_version.category,
      'end_date', v_version.end_date,
      'keeper', v_version.keeper,
      'reward', v_version.reward,
      'penalty', v_version.penalty
    ),
    'fulfillment', v_fulfillment
  );
end;
$$;

create or replace function public.lf_witness_sign(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_surface public.surface,
  p_ip_hash char(64),
  p_user_agent_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_promise public.promises%rowtype;
  v_participant_id uuid;
  v_signed_at timestamptz;
  v_witness_nickname text;
  v_response jsonb;
  v_recipient uuid;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-sign');
  if v_cached is not null then
    return v_cached;
  end if;

  select * into v_promise
    from public.promises
   where id = p_promise_id
   for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select pp.id, u.nickname
    into v_participant_id, v_witness_nickname
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role = 'WITNESS'
     and pp.status = 'JOINED'
   for update of pp;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_promise.current_version_id is null or v_promise.activated_at is null then
    raise exception 'E_STATE_CONFLICT';
  end if;

  select a.acted_at into v_signed_at
    from public.approvals a
   where a.promise_id = p_promise_id
     and a.user_id = p_actor
     and a.action = 'WITNESS_SIGN';

  if v_signed_at is null then
    v_signed_at := now();
    insert into public.approvals (
      promise_id, version_id, user_id, role, action, content_hash, surface,
      ip_hash, user_agent_hash, acted_at
    )
    select v_promise.id, v.id, p_actor, 'WITNESS', 'WITNESS_SIGN', v.content_hash,
           p_surface, p_ip_hash, p_user_agent_hash, v_signed_at
      from public.promise_versions v
     where v.id = v_promise.current_version_id;

    for v_recipient in
      select pp.user_id
        from public.promise_participants pp
       where pp.promise_id = p_promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED'
         and pp.user_id is not null
    loop
      perform public.lf_notification_outbox_enqueue(
        v_recipient,
        p_promise_id,
        'NT-18',
        jsonb_build_object(
          'promiseTitle', v_promise.title,
          'partnerNickname', v_witness_nickname
        ),
        'witness-sign:' || v_participant_id::text,
        v_signed_at
      );
    end loop;
  end if;

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'signed_at', v_signed_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_witness_invite_list(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.lf_witness_invite(uuid, uuid, uuid, char(64), uuid)
  from public, anon, authenticated;
revoke all on function public.lf_witness_join(uuid, uuid, char(64))
  from public, anon, authenticated;
revoke all on function public.lf_witness_detail(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.lf_witness_sign(uuid, uuid, uuid, public.surface, char(64), char(64))
  from public, anon, authenticated;

grant execute on function public.lf_witness_invite_list(uuid, uuid) to service_role;
grant execute on function public.lf_witness_invite(uuid, uuid, uuid, char(64), uuid) to service_role;
grant execute on function public.lf_witness_join(uuid, uuid, char(64)) to service_role;
grant execute on function public.lf_witness_detail(uuid, uuid) to service_role;
grant execute on function public.lf_witness_sign(uuid, uuid, uuid, public.surface, char(64), char(64))
  to service_role;
