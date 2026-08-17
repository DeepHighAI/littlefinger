-- MOD-03 완료 축하 전달 기록과 실제 노출 확인 경계.

-- server-only: completion_celebrations
create table public.completion_celebrations (
  promise_id uuid not null references public.promises(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  participant_role public.participant_role not null,
  keep_rate_before int,
  keep_rate_after int,
  created_at timestamptz not null default now(),
  claim_id uuid unique,
  claimed_at timestamptz,
  shown_at timestamptz,
  primary key (promise_id, user_id),
  constraint completion_celebrations_party_role
    check (participant_role in ('CREATOR', 'PARTNER')),
  constraint completion_celebrations_before_range
    check (keep_rate_before is null or keep_rate_before between 0 and 100),
  constraint completion_celebrations_after_range
    check (keep_rate_after is null or keep_rate_after between 0 and 100)
);

alter table public.completion_celebrations enable row level security;
revoke all on table public.completion_celebrations from public, anon, authenticated;
grant all on table public.completion_celebrations to service_role;

create or replace function public.lf_fulfillment_submit(
  p_idempotency_key     uuid,
  p_actor               uuid,
  p_promise_id          uuid,
  p_answer              public.fulfillment_answer,
  p_comment             text,
  p_revise              boolean,
  p_evidence_upload_ids uuid[],
  p_retained_evidence_ids uuid[],
  p_surface             public.surface
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_comment_max constant int := 200;
  c_evidence_max constant int := 3;
  c_retention_days constant int := 365;
  v_cached             jsonb;
  v_promise            public.promises%rowtype;
  v_actor_role         public.participant_role;
  v_actor_nickname     text;
  v_actor_check_id     uuid;
  v_actor_submitted    timestamptz;
  v_actor_revised      timestamptz;
  v_other_check_id     uuid;
  v_other_answer       public.fulfillment_answer;
  v_comment            text := nullif(public.lf_normalize_input(p_comment), '');
  v_upload_ids         uuid[] := coalesce(p_evidence_upload_ids, '{}'::uuid[]);
  v_retained_ids       uuid[] := coalesce(p_retained_evidence_ids, '{}'::uuid[]);
  v_expected           int;
  v_actual             int;
  v_result             public.promise_status := 'CHECKING';
  v_keep_rates_before  jsonb := '{}'::jsonb;
  v_response           jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'fulfillment-submit'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select pp.role, u.nickname
    into v_actor_role, v_actor_nickname
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_promise.status <> 'CHECKING'
     or v_promise.check_deadline_at is null
     or v_promise.check_deadline_at <= now() then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if char_length(coalesce(v_comment, '')) > c_comment_max then
    raise exception 'E_VALIDATION';
  end if;

  if cardinality(v_upload_ids) > c_evidence_max
     or cardinality(v_retained_ids) > c_evidence_max
     or cardinality(v_upload_ids) + cardinality(v_retained_ids) > c_evidence_max then
    raise exception 'E_VALIDATION';
  end if;

  select count(distinct value)::int
    into v_actual
    from unnest(v_upload_ids || v_retained_ids) value;
  if v_actual <> cardinality(v_upload_ids) + cardinality(v_retained_ids) then
    raise exception 'E_VALIDATION';
  end if;

  select fc.id, fc.submitted_at, fc.revised_at
    into v_actor_check_id, v_actor_submitted, v_actor_revised
    from public.fulfillment_checks fc
   where fc.promise_id = p_promise_id
     and fc.user_id = p_actor
     and fc.round_no = v_promise.check_round_no;

  select fc.id, fc.answer
    into v_other_check_id, v_other_answer
    from public.fulfillment_checks fc
    join public.promise_participants pp
      on pp.promise_id = fc.promise_id
     and pp.user_id = fc.user_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where fc.promise_id = p_promise_id
     and fc.user_id <> p_actor
     and fc.round_no = v_promise.check_round_no;

  if v_actor_check_id is null then
    if coalesce(p_revise, false) or cardinality(v_retained_ids) > 0 then
      raise exception 'E_STATE_CONFLICT';
    end if;
  else
    if not coalesce(p_revise, false)
       or v_actor_revised is not null
       or v_other_check_id is not null then
      raise exception 'E_STATE_CONFLICT';
    end if;

    select count(*)::int
      into v_actual
      from public.fulfillment_evidences fe
     where fe.id = any(v_retained_ids)
       and fe.check_id = v_actor_check_id
       and fe.promise_id = p_promise_id
       and fe.uploaded_by = p_actor
       and fe.removed_at is null
       and fe.purged_at is null;
    if v_actual <> cardinality(v_retained_ids) then
      raise exception 'E_STATE_CONFLICT';
    end if;
  end if;

  v_expected := cardinality(v_upload_ids);
  select count(*)::int
    into v_actual
    from public.evidence_uploads eu
   where eu.id = any(v_upload_ids)
     and eu.promise_id = p_promise_id
     and eu.round_no = v_promise.check_round_no
     and eu.uploaded_by = p_actor
     and eu.status = 'READY';
  if v_actual <> v_expected then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_actor_check_id is null then
    insert into public.fulfillment_checks (
      promise_id, version_id, user_id, round_no, answer, comment, surface
    )
    values (
      p_promise_id, v_promise.current_version_id, p_actor, v_promise.check_round_no,
      p_answer, v_comment, p_surface
    )
    returning id, submitted_at, revised_at
      into v_actor_check_id, v_actor_submitted, v_actor_revised;
  else
    update public.fulfillment_checks
       set answer = p_answer,
           comment = v_comment,
           surface = p_surface,
           revised_at = now()
     where id = v_actor_check_id
       and revised_at is null
    returning submitted_at, revised_at
      into v_actor_submitted, v_actor_revised;

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;

    update public.fulfillment_evidences
       set removed_at = now()
     where check_id = v_actor_check_id
       and removed_at is null
       and not (id = any(v_retained_ids));
  end if;

  insert into public.fulfillment_evidences (
    upload_id,
    check_id,
    promise_id,
    uploaded_by,
    storage_key,
    thumb_key,
    mime,
    bytes,
    width,
    height
  )
  select eu.id,
         v_actor_check_id,
         eu.promise_id,
         eu.uploaded_by,
         eu.storage_key,
         eu.thumb_key,
         eu.mime,
         eu.bytes,
         eu.width,
         eu.height
    from public.evidence_uploads eu
   where eu.id = any(v_upload_ids);

  update public.evidence_uploads
     set status = 'BOUND',
         bound_at = now(),
         updated_at = now()
   where id = any(v_upload_ids)
     and status = 'READY';
  get diagnostics v_actual = row_count;
  if v_actual <> v_expected then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_other_check_id is not null then
    if p_answer = 'KEPT' and v_other_answer = 'KEPT' then
      v_result := 'COMPLETED';
    elsif p_answer = 'NOT_KEPT' and v_other_answer = 'NOT_KEPT' then
      v_result := 'BROKEN';
    else
      v_result := 'DISPUTED';
    end if;

    update public.promises
       set status = v_result,
           closed_at = case when v_result in ('COMPLETED', 'BROKEN') then now() else null end,
           lock_version = lock_version + 1,
           updated_at = now()
     where id = p_promise_id
       and status = 'CHECKING';

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;

    if v_result in ('COMPLETED', 'BROKEN') then
      update public.reminder_schedules
         set status = 'CANCELED'
       where promise_id = p_promise_id
         and status = 'PENDING';

      update public.fulfillment_evidences
         set purge_after =
               (now() at time zone 'Asia/Seoul')::date + c_retention_days
       where promise_id = p_promise_id
         and purge_after is null;
    end if;

    if v_result = 'COMPLETED' then
      select coalesce(
               jsonb_object_agg(pp.user_id::text, to_jsonb(tp.keep_rate)),
               '{}'::jsonb
             )
        into v_keep_rates_before
        from public.promise_participants pp
        left join public.trust_profiles tp on tp.user_id = pp.user_id
       where pp.promise_id = p_promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED';
    end if;

    perform public.lf_recompute_promise_trust_profiles(p_promise_id);

    if v_result = 'COMPLETED' then
      insert into public.completion_celebrations (
        promise_id, user_id, participant_role, keep_rate_before, keep_rate_after
      )
      select p_promise_id,
             pp.user_id,
             pp.role,
             (v_keep_rates_before ->> pp.user_id::text)::int,
             tp.keep_rate
        from public.promise_participants pp
        left join public.trust_profiles tp on tp.user_id = pp.user_id
       where pp.promise_id = p_promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED'
      on conflict (promise_id, user_id) do nothing;

      insert into public.daily_metrics (date, completed_count)
      values ((now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (date) do update
        set completed_count = public.daily_metrics.completed_count + 1,
            updated_at = now();
    end if;
  end if;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'status', v_result,
           'round_no', v_promise.check_round_no,
           'submitted_at', v_actor_submitted,
           'revised_at', v_actor_revised,
           'waiting_for_partner', v_other_check_id is null,
           'title', v_promise.title,
           'actor_nickname', v_actor_nickname,
           'notification_recipients', coalesce(
             jsonb_agg(
               jsonb_build_object('user_id', pp.user_id, 'role', pp.role)
               order by case pp.role when 'CREATOR' then 1 when 'PARTNER' then 2 else 3 end,
                        pp.id
             ) filter (where pp.user_id is not null),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.status = 'JOINED';

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_fulfillment_submit(
  uuid,
  uuid,
  uuid,
  public.fulfillment_answer,
  text,
  boolean,
  uuid[],
  uuid[],
  public.surface
) from public, anon, authenticated;
grant execute on function public.lf_fulfillment_submit(
  uuid,
  uuid,
  uuid,
  public.fulfillment_answer,
  text,
  boolean,
  uuid[],
  uuid[],
  public.surface
) to service_role;

create or replace function public.lf_completion_celebration_claim(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_status public.promise_status;
  v_title text;
  v_actor_role public.participant_role;
  v_celebration public.completion_celebrations%rowtype;
  v_counterpart_nickname text;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'completion-celebration-claim'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select p.status, p.title
    into v_status, v_title
    from public.promises p
   where p.id = p_promise_id
   for update;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_status <> 'COMPLETED' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  select pp.role
    into v_actor_role
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select cc.*
    into v_celebration
    from public.completion_celebrations cc
   where cc.promise_id = p_promise_id
     and cc.user_id = p_actor
     and cc.participant_role = v_actor_role
   for update;

  if not found or v_celebration.claim_id is not null then
    v_response := jsonb_build_object('available', false, 'celebration', null);
    perform public.lf_idempotency_finish(p_idempotency_key, v_response);
    return v_response;
  end if;

  select u.nickname
    into v_counterpart_nickname
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.role <> v_actor_role
     and pp.status = 'JOINED'
   order by pp.id
   limit 1;

  update public.completion_celebrations
     set claim_id = gen_random_uuid(),
         claimed_at = now()
   where promise_id = p_promise_id
     and user_id = p_actor
     and claim_id is null
  returning * into v_celebration;
  if not found then
    v_response := jsonb_build_object('available', false, 'celebration', null);
  else
    v_response := jsonb_build_object(
      'available', true,
      'celebration', jsonb_build_object(
        'claim_id', v_celebration.claim_id,
        'promise_id', p_promise_id,
        'title', v_title,
        'counterpart_nickname', v_counterpart_nickname,
        'keep_rate_before', v_celebration.keep_rate_before,
        'keep_rate_after', v_celebration.keep_rate_after
      )
    );
  end if;

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_completion_celebration_shown(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_shown_at timestamptz;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_actor,
    'completion-celebration-shown'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select cc.shown_at
    into v_shown_at
    from public.completion_celebrations cc
   where cc.promise_id = p_promise_id
     and cc.user_id = p_actor
     and cc.claim_id = p_claim_id
   for update;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_shown_at is null then
    update public.completion_celebrations
       set shown_at = now()
     where promise_id = p_promise_id
       and user_id = p_actor
       and claim_id = p_claim_id
    returning shown_at into v_shown_at;
  end if;

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'shown_at', v_shown_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_completion_celebration_claim(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.lf_completion_celebration_shown(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.lf_completion_celebration_claim(uuid, uuid, uuid) to service_role;
grant execute on function public.lf_completion_celebration_shown(uuid, uuid, uuid, uuid) to service_role;
