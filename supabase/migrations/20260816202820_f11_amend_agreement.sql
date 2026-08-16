-- F-11 — 양측 대등 변경·파기 합의(T-07~T-10)와 활성 버전 이력.

alter table public.promise_versions
  drop constraint if exists promise_versions_promise_id_version_no_key;

alter table public.promise_versions alter column version_no drop not null;

create unique index promise_versions_numbered_unique
  on public.promise_versions (promise_id, version_no)
  where version_no is not null;

alter table public.promise_versions
  add constraint promise_versions_proposal_number_check
  check (
    version_no is not null
    or (activated_at is null and superseded_at is null)
  );

create or replace function public.lf_amend_auto_withdraw_days()
returns int
language sql
immutable
security definer
set search_path = ''
as $$
  select 7;
$$;

create or replace function public.lf_promise_detail_version_json(
  p_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           -- 제안본은 활성화 전까지 번호를 점유하지 않지만 비교 화면에서는 다음 번호로 보인다.
           'version_no', coalesce(
             v.version_no,
             (select coalesce(max(numbered.version_no), 0) + 1
                from public.promise_versions numbered
               where numbered.promise_id = v.promise_id
                 and numbered.version_no is not null)
           ),
           'title', v.title,
           'body', v.body,
           'category', v.category,
           'end_date', v.end_date,
           'keeper', v.keeper,
           'reward', v.reward,
           'penalty', v.penalty,
           'content_hash', v.content_hash,
           'fingerprint', upper(
             substr(v.content_hash, 1, 4) || '-' ||
             substr(v.content_hash, 5, 4) || '-' ||
             substr(v.content_hash, 9, 2)
           ),
           'activated_at', v.activated_at,
           'superseded_at', v.superseded_at,
           'change_reason', v.change_reason
         )
    from public.promise_versions v
   where v.id = p_version_id;
$$;

create or replace function public.lf_promise_amend_request(
  p_idempotency_key uuid,
  p_actor           uuid,
  p_promise_id      uuid,
  p_type            text,
  p_proposed        jsonb,
  p_reason          text,
  p_surface         public.surface,
  p_ip_hash         text,
  p_user_agent_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached       jsonb;
  v_promise      public.promises%rowtype;
  v_current      public.promise_versions%rowtype;
  v_role         public.participant_role;
  v_reason       text := nullif(public.lf_normalize_input(p_reason), '');
  v_title        text;
  v_body         text;
  v_category     text;
  v_keeper       text;
  v_reward       text;
  v_penalty      text;
  v_end_date     date;
  v_proposal_id  uuid;
  v_request_id   uuid;
  v_expires_at   timestamptz;
  v_next_number  int;
  v_hash         text;
  v_response     jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'promise-amend-request'
  );
  if v_cached is not null then return v_cached; end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
   for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;

  select pp.role
    into v_role
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if v_promise.status <> 'ACTIVE' then raise exception 'E_STATE_CONFLICT'; end if;

  if p_type is null or p_type not in ('AMEND', 'CANCEL') then
    raise exception 'E_VALIDATION';
  end if;
  if char_length(coalesce(v_reason, '')) > 200 then raise exception 'E_VALIDATION'; end if;

  select *
    into strict v_current
    from public.promise_versions
   where id = v_promise.current_version_id
     and promise_id = p_promise_id
     and version_no is not null
     and activated_at is not null;

  if p_type = 'CANCEL' then
    if p_proposed is not null then raise exception 'E_VALIDATION'; end if;
    v_hash := v_current.content_hash;
  else
    if p_proposed is null
       or jsonb_typeof(p_proposed) <> 'object'
       or (select count(*) from pg_catalog.jsonb_object_keys(p_proposed)) <> 7
       or not p_proposed ?& array[
         'title', 'body', 'category', 'end_date', 'keeper', 'reward', 'penalty'
       ] then
      raise exception 'E_VALIDATION';
    end if;

    v_title := public.lf_normalize_input(p_proposed ->> 'title');
    v_body := public.lf_normalize_input(p_proposed ->> 'body');
    v_category := p_proposed ->> 'category';
    v_keeper := coalesce(nullif(btrim(p_proposed ->> 'keeper'), ''), 'BOTH');
    v_reward := nullif(public.lf_normalize_input(p_proposed ->> 'reward'), '');
    v_penalty := nullif(public.lf_normalize_input(p_proposed ->> 'penalty'), '');
    begin
      v_end_date := (p_proposed ->> 'end_date')::date;
    exception when others then
      raise exception 'E_VALIDATION';
    end;

    perform public.lf_assert_promise_content(
      v_title, v_body, v_category, v_keeper, v_reward, v_penalty
    );
    if v_end_date <= (now() at time zone 'Asia/Seoul')::date
       or v_end_date > (now() at time zone 'Asia/Seoul')::date + public.lf_end_date_max_days() then
      raise exception 'E_VALIDATION';
    end if;
    if row(v_title, v_body, v_category, v_end_date, v_keeper, v_reward, v_penalty)
       is not distinct from
       row(v_current.title, v_current.body, v_current.category::text, v_current.end_date,
           v_current.keeper::text, v_current.reward, v_current.penalty) then
      raise exception 'E_VALIDATION';
    end if;

    v_next_number := v_current.version_no + 1;
    v_hash := public.lf_content_hash(
      v_title,
      v_body,
      v_category::public.promise_category,
      v_end_date,
      v_keeper::public.keeper,
      v_reward,
      v_penalty,
      v_next_number
    );
    insert into public.promise_versions (
      promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
      content_hash, created_by, change_reason
    ) values (
      p_promise_id, null, v_title, v_body, v_category::public.promise_category, v_end_date,
      v_keeper::public.keeper, v_reward, v_penalty, v_hash, p_actor, v_reason
    ) returning id into v_proposal_id;
  end if;

  v_expires_at := now() + make_interval(days => public.lf_amend_auto_withdraw_days());
  insert into public.amend_requests (
    promise_id, requester_id, type, proposed_version_id, reason, expires_at
  ) values (
    p_promise_id, p_actor, p_type::public.amend_type, v_proposal_id, v_reason, v_expires_at
  ) returning id into v_request_id;

  update public.promises
     set status = 'AMEND_PENDING', lock_version = lock_version + 1, updated_at = now()
   where id = p_promise_id and status = 'ACTIVE';
  if not found then raise exception 'E_STATE_CONFLICT'; end if;

  insert into public.approvals (
    promise_id, version_id, user_id, role, action, content_hash, comment, surface,
    ip_hash, user_agent_hash
  ) values (
    p_promise_id, coalesce(v_proposal_id, v_current.id), p_actor, v_role,
    case when p_type = 'AMEND'
      then 'AMEND_REQUEST'::public.approval_action
      else 'CANCEL_REQUEST'::public.approval_action
    end,
    v_hash, v_reason, p_surface, p_ip_hash, p_user_agent_hash
  );

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'status', 'AMEND_PENDING',
    'request_id', v_request_id,
    'type', p_type,
    'expires_at', v_expires_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_promise_amend_respond(
  p_idempotency_key uuid,
  p_actor           uuid,
  p_promise_id      uuid,
  p_request_id      uuid,
  p_decision        text,
  p_surface         public.surface,
  p_ip_hash         text,
  p_user_agent_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached      jsonb;
  v_promise     public.promises%rowtype;
  v_request     public.amend_requests%rowtype;
  v_current     public.promise_versions%rowtype;
  v_proposal    public.promise_versions%rowtype;
  v_role        public.participant_role;
  v_action      public.approval_action;
  v_version_id  uuid;
  v_hash        text;
  v_version_no  int;
  v_status      public.promise_status;
  v_response    jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'promise-amend-respond'
  );
  if v_cached is not null then return v_cached; end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
   for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;

  select pp.role
    into v_role
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if v_promise.status <> 'AMEND_PENDING' then raise exception 'E_STATE_CONFLICT'; end if;

  select *
    into v_request
    from public.amend_requests
   where id = p_request_id
     and promise_id = p_promise_id
     and status = 'PENDING'
   for update;
  if not found then raise exception 'E_STATE_CONFLICT'; end if;
  if v_request.requester_id = p_actor then raise exception 'E_FORBIDDEN'; end if;
  if p_decision is null or p_decision not in ('APPROVE', 'DECLINE') then
    raise exception 'E_VALIDATION';
  end if;
  if v_request.expires_at <= now() then raise exception 'E_STATE_CONFLICT'; end if;

  select * into strict v_current
    from public.promise_versions
   where id = v_promise.current_version_id
     and version_no is not null
     and activated_at is not null;

  if v_request.proposed_version_id is not null then
    select * into strict v_proposal
      from public.promise_versions
     where id = v_request.proposed_version_id
       and promise_id = p_promise_id
     for update;
    v_version_id := v_proposal.id;
    v_hash := v_proposal.content_hash;
  else
    v_version_id := v_current.id;
    v_hash := v_current.content_hash;
  end if;

  if p_decision = 'DECLINE' then
    update public.amend_requests
       set status = 'DECLINED', responded_by = p_actor, responded_at = now()
     where id = p_request_id and status = 'PENDING';
    update public.promises
       set status = 'ACTIVE', lock_version = lock_version + 1, updated_at = now()
     where id = p_promise_id and status = 'AMEND_PENDING';
    v_action := case when v_request.type = 'AMEND'
      then 'AMEND_DECLINE'::public.approval_action
      else 'CANCEL_DECLINE'::public.approval_action
    end;
    v_status := 'ACTIVE';
    v_version_no := null;
  elsif v_request.type = 'CANCEL' then
    update public.amend_requests
       set status = 'APPROVED', responded_by = p_actor, responded_at = now()
     where id = p_request_id and status = 'PENDING';
    update public.promises
       set status = 'CANCELED', closed_at = now(), lock_version = lock_version + 1,
           updated_at = now()
     where id = p_promise_id and status = 'AMEND_PENDING';
    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = p_promise_id and status = 'PENDING';
    v_action := 'CANCEL_APPROVE';
    v_status := 'CANCELED';
    v_version_no := null;
  else
    if v_proposal.end_date < (now() at time zone 'Asia/Seoul')::date then
      raise exception 'E_VALIDATION';
    end if;
    v_version_no := v_current.version_no + 1;
    v_hash := public.lf_content_hash(
      v_proposal.title, v_proposal.body, v_proposal.category, v_proposal.end_date,
      v_proposal.keeper, v_proposal.reward, v_proposal.penalty, v_version_no
    );
    update public.promise_versions
       set superseded_at = now()
     where id = v_current.id and superseded_at is null;
    update public.promise_versions
       set version_no = v_version_no, content_hash = v_hash, activated_at = now()
     where id = v_proposal.id and version_no is null and activated_at is null;
    if not found then raise exception 'E_STATE_CONFLICT'; end if;
    update public.amend_requests
       set status = 'APPROVED', responded_by = p_actor, responded_at = now()
     where id = p_request_id and status = 'PENDING';
    update public.promises
       set status = 'ACTIVE', current_version_id = v_proposal.id,
           title = v_proposal.title, body = v_proposal.body, category = v_proposal.category,
           end_date = v_proposal.end_date, keeper = v_proposal.keeper,
           reward = v_proposal.reward, penalty = v_proposal.penalty,
           lock_version = lock_version + 1, updated_at = now()
     where id = p_promise_id and status = 'AMEND_PENDING';

    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = p_promise_id
       and status = 'PENDING'
       and kind in ('D7', 'D3', 'D1', 'DDAY');
    insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
    select p_promise_id, recipient.user_id,
           (case when offset_days.days = 0 then 'DDAY'
                 else 'D' || offset_days.days end)::public.reminder_kind,
           ((v_proposal.end_date - offset_days.days)::timestamp
             + make_interval(hours => public.lf_reminder_send_hour_kst()))
             at time zone 'Asia/Seoul'
      from (
        select pp.user_id
          from public.promise_participants pp
         where pp.promise_id = p_promise_id
           and pp.role in ('CREATOR', 'PARTNER')
           and pp.status = 'JOINED'
      ) recipient
      cross join unnest(public.lf_reminder_offsets_days()) as offset_days(days)
     where ((v_proposal.end_date - offset_days.days)::timestamp
             + make_interval(hours => public.lf_reminder_send_hour_kst()))
             at time zone 'Asia/Seoul' > now();
    v_action := 'AMEND_APPROVE';
    v_status := 'ACTIVE';
  end if;

  insert into public.approvals (
    promise_id, version_id, user_id, role, action, content_hash, surface,
    ip_hash, user_agent_hash
  ) values (
    p_promise_id, v_version_id, p_actor, v_role, v_action, v_hash, p_surface,
    p_ip_hash, p_user_agent_hash
  );

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'status', v_status,
    'request_id', p_request_id,
    'request_status', case when p_decision = 'DECLINE' then 'DECLINED' else 'APPROVED' end,
    'version_no', v_version_no
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_promise_amend_withdraw(
  p_idempotency_key uuid,
  p_actor           uuid,
  p_promise_id      uuid,
  p_request_id      uuid,
  p_surface         public.surface,
  p_ip_hash         text,
  p_user_agent_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached     jsonb;
  v_promise    public.promises%rowtype;
  v_request    public.amend_requests%rowtype;
  v_role       public.participant_role;
  v_version    public.promise_versions%rowtype;
  v_response   jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'promise-amend-withdraw'
  );
  if v_cached is not null then return v_cached; end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
   for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;

  select pp.role
    into v_role
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if v_promise.status <> 'AMEND_PENDING' then raise exception 'E_STATE_CONFLICT'; end if;

  select *
    into v_request
    from public.amend_requests
   where id = p_request_id
     and promise_id = p_promise_id
     and status = 'PENDING'
   for update;
  if not found then raise exception 'E_STATE_CONFLICT'; end if;
  if v_request.requester_id <> p_actor then raise exception 'E_FORBIDDEN'; end if;
  if v_request.expires_at <= now() then raise exception 'E_STATE_CONFLICT'; end if;

  select * into strict v_version
    from public.promise_versions
   where id = coalesce(v_request.proposed_version_id, v_promise.current_version_id);

  update public.amend_requests
     set status = 'WITHDRAWN', responded_by = p_actor, responded_at = now()
   where id = p_request_id and status = 'PENDING';
  update public.promises
     set status = 'ACTIVE', lock_version = lock_version + 1, updated_at = now()
   where id = p_promise_id and status = 'AMEND_PENDING';

  insert into public.approvals (
    promise_id, version_id, user_id, role, action, content_hash, surface,
    ip_hash, user_agent_hash
  ) values (
    p_promise_id, v_version.id, p_actor, v_role, 'AMEND_WITHDRAW', v_version.content_hash,
    p_surface, p_ip_hash, p_user_agent_hash
  );

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'status', 'ACTIVE',
    'request_id', p_request_id,
    'request_status', 'WITHDRAWN'
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_promise_version_list(
  p_actor      uuid,
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
  if not exists (
    select 1
      from public.promises p
      join public.promise_participants pp
        on pp.promise_id = p.id
       and pp.user_id = p_actor
       and pp.status = 'JOINED'
     where p.id = p_promise_id
       and not (p.hidden_by ? p_actor::text)
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'versions', coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'version', public.lf_promise_detail_version_json(v.id),
                 'change_requester', case when requester.user_id is null then null else
                   jsonb_build_object(
                     'user_id', requester.user_id,
                     'nickname', requester.nickname,
                     'profile_image_url', requester.profile_image_url
                   ) end,
                 'approved_by', case when approver.user_id is null then null else
                   jsonb_build_object(
                     'user_id', approver.user_id,
                     'nickname', approver.nickname,
                     'profile_image_url', approver.profile_image_url
                   ) end,
                 'approved_at', approver.acted_at,
                 'change_reason', v.change_reason
               ) order by v.version_no desc
             ),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promise_versions v
    left join lateral (
      select a.user_id, u.nickname, u.profile_image_url
        from public.approvals a
        join public.users u on u.id = a.user_id
       where a.version_id = v.id and a.action = 'AMEND_REQUEST'
       order by a.acted_at, a.id
       limit 1
    ) requester on true
    left join lateral (
      select a.user_id, u.nickname, u.profile_image_url, a.acted_at
        from public.approvals a
        join public.users u on u.id = a.user_id
       where a.version_id = v.id and a.action in ('AMEND_APPROVE', 'APPROVE')
       order by a.acted_at desc, a.id desc
       limit 1
    ) approver on true
   where v.promise_id = p_promise_id
     and v.version_no is not null
     and v.activated_at is not null;

  return v_response;
end;
$$;

revoke all on function public.lf_amend_auto_withdraw_days()
  from public, anon, authenticated;
revoke all on function public.lf_promise_amend_request(
  uuid, uuid, uuid, text, jsonb, text, public.surface, text, text
) from public, anon, authenticated;
revoke all on function public.lf_promise_amend_respond(
  uuid, uuid, uuid, uuid, text, public.surface, text, text
) from public, anon, authenticated;
revoke all on function public.lf_promise_amend_withdraw(
  uuid, uuid, uuid, uuid, public.surface, text, text
) from public, anon, authenticated;
revoke all on function public.lf_promise_version_list(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.lf_amend_auto_withdraw_days() to service_role;
grant execute on function public.lf_promise_amend_request(
  uuid, uuid, uuid, text, jsonb, text, public.surface, text, text
) to service_role;
grant execute on function public.lf_promise_amend_respond(
  uuid, uuid, uuid, uuid, text, public.surface, text, text
) to service_role;
grant execute on function public.lf_promise_amend_withdraw(
  uuid, uuid, uuid, uuid, public.surface, text, text
) to service_role;
grant execute on function public.lf_promise_version_list(uuid, uuid) to service_role;
