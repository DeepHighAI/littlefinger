-- F-08 core evidence lifecycle: private pre-upload, transactional binding, and retention.

create type public.evidence_upload_status as enum (
  'PENDING',
  'READY',
  'BOUND',
  'DISCARDED',
  'FAILED'
);

-- server-only: evidence_uploads
create table public.evidence_uploads (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  promise_id uuid not null references public.promises (id) on delete cascade,
  round_no int not null check (round_no > 0),
  uploaded_by uuid not null references public.users (id),
  status public.evidence_upload_status not null default 'PENDING',
  storage_key text,
  thumb_key text,
  mime text,
  bytes int,
  width int,
  height int,
  expires_at timestamptz not null,
  bound_at timestamptz,
  discarded_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (uploaded_by, idempotency_key),
  check (
    status <> 'READY'
    or (
      storage_key is not null
      and thumb_key is not null
      and mime = 'image/jpeg'
      and bytes > 0
      and width > 0
      and height > 0
    )
  )
);

create index evidence_uploads_owner_round_idx
  on public.evidence_uploads (uploaded_by, promise_id, round_no, status);
create index evidence_uploads_cleanup_idx
  on public.evidence_uploads (status, expires_at);

alter table public.evidence_uploads enable row level security;
revoke all on table public.evidence_uploads from public, anon, authenticated;
grant all on table public.evidence_uploads to service_role;

alter table public.fulfillment_evidences
  add column upload_id uuid unique references public.evidence_uploads (id),
  add column removed_at timestamptz,
  add column purged_at timestamptz;

drop policy if exists "evidences read participants"
  on public.fulfillment_evidences;
revoke all on table public.fulfillment_evidences
  from public, anon, authenticated;
grant all on table public.fulfillment_evidences to service_role;

create or replace function public.lf_evidence_upload_reserve(
  p_idempotency_key uuid,
  p_actor           uuid,
  p_promise_id      uuid,
  p_round_no        int
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  c_max_count constant int := 3;
  v_existing public.evidence_uploads%rowtype;
  v_promise  public.promises%rowtype;
  v_upload   public.evidence_uploads%rowtype;
  v_count    int;
begin
  perform public.lf_assert_actor(p_actor);

  select *
    into v_existing
    from public.evidence_uploads eu
   where eu.uploaded_by = p_actor
     and eu.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'upload_id', v_existing.id,
      'status', v_existing.status,
      'mime', v_existing.mime,
      'bytes', v_existing.bytes,
      'width', v_existing.width,
      'height', v_existing.height
    );
  end if;

  select *
    into v_promise
    from public.promises p
   where p.id = p_promise_id
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

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

  if v_promise.status <> 'CHECKING'
     or v_promise.check_deadline_at is null
     or v_promise.check_deadline_at <= now()
     or v_promise.check_round_no <> p_round_no then
    raise exception 'E_STATE_CONFLICT';
  end if;

  select count(*)::int
    into v_count
    from public.evidence_uploads eu
   where eu.uploaded_by = p_actor
     and eu.promise_id = p_promise_id
     and eu.round_no = p_round_no
     and eu.status in ('PENDING', 'READY');

  if v_count >= c_max_count then
    raise exception 'E_VALIDATION';
  end if;

  insert into public.evidence_uploads (
    idempotency_key,
    promise_id,
    round_no,
    uploaded_by,
    expires_at
  )
  values (
    p_idempotency_key,
    p_promise_id,
    p_round_no,
    p_actor,
    v_promise.check_deadline_at
  )
  returning * into v_upload;

  return jsonb_build_object(
    'upload_id', v_upload.id,
    'status', v_upload.status,
    'mime', v_upload.mime,
    'bytes', v_upload.bytes,
    'width', v_upload.width,
    'height', v_upload.height
  );
end;
$$;

create or replace function public.lf_evidence_upload_complete(
  p_actor       uuid,
  p_upload_id   uuid,
  p_storage_key text,
  p_thumb_key   text,
  p_bytes       int,
  p_width       int,
  p_height      int
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_upload public.evidence_uploads%rowtype;
begin
  perform public.lf_assert_actor(p_actor);

  select *
    into v_upload
    from public.evidence_uploads eu
   where eu.id = p_upload_id
     and eu.uploaded_by = p_actor
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_upload.status = 'READY' then
    return jsonb_build_object(
      'upload_id', v_upload.id,
      'status', v_upload.status,
      'mime', v_upload.mime,
      'bytes', v_upload.bytes,
      'width', v_upload.width,
      'height', v_upload.height
    );
  end if;

  if v_upload.status <> 'PENDING'
     or nullif(p_storage_key, '') is null
     or nullif(p_thumb_key, '') is null
     or p_bytes <= 0
     or p_width <= 0
     or p_height <= 0 then
    raise exception 'E_STATE_CONFLICT';
  end if;

  update public.evidence_uploads
     set status = 'READY',
         storage_key = p_storage_key,
         thumb_key = p_thumb_key,
         mime = 'image/jpeg',
         bytes = p_bytes,
         width = p_width,
         height = p_height,
         updated_at = now()
   where id = p_upload_id
  returning * into v_upload;

  return jsonb_build_object(
    'upload_id', v_upload.id,
    'status', v_upload.status,
    'mime', v_upload.mime,
    'bytes', v_upload.bytes,
    'width', v_upload.width,
    'height', v_upload.height
  );
end;
$$;

create or replace function public.lf_evidence_upload_discard(
  p_actor     uuid,
  p_upload_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_upload public.evidence_uploads%rowtype;
begin
  perform public.lf_assert_actor(p_actor);

  select *
    into v_upload
    from public.evidence_uploads eu
   where eu.id = p_upload_id
     and eu.uploaded_by = p_actor
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_upload.status = 'BOUND' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_upload.status <> 'DISCARDED' then
    update public.evidence_uploads
       set status = 'DISCARDED',
           discarded_at = now(),
           updated_at = now()
     where id = p_upload_id
    returning * into v_upload;
  end if;

  return jsonb_build_object(
    'upload_id', v_upload.id,
    'status', v_upload.status,
    'storage_key', v_upload.storage_key,
    'thumb_key', v_upload.thumb_key
  );
end;
$$;

revoke all on function public.lf_evidence_upload_reserve(uuid, uuid, uuid, int)
  from public, anon, authenticated;
revoke all on function public.lf_evidence_upload_complete(
  uuid, uuid, text, text, int, int, int
) from public, anon, authenticated;
revoke all on function public.lf_evidence_upload_discard(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.lf_evidence_upload_reserve(uuid, uuid, uuid, int)
  to service_role;
grant execute on function public.lf_evidence_upload_complete(
  uuid, uuid, text, text, int, int, int
) to service_role;
grant execute on function public.lf_evidence_upload_discard(uuid, uuid)
  to service_role;

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

    perform public.lf_recompute_promise_trust_profiles(p_promise_id);

    if v_result = 'COMPLETED' then
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

create or replace function public.lf_fulfillment_evidence_views(
  p_check_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'evidence_id', fe.id,
               'mime', fe.mime,
               'bytes', fe.bytes,
               'width', fe.width,
               'height', fe.height,
               'availability', case
                 when fe.blinded_at is not null then 'BLINDED'
                 when fe.purged_at is not null then 'EXPIRED'
                 else 'AVAILABLE'
               end
             )
             order by fe.created_at, fe.id
           ),
           '[]'::jsonb
         )
    from public.fulfillment_evidences fe
   where fe.check_id = p_check_id
     and fe.removed_at is null;
$$;

create or replace function public.lf_promise_fulfillment_detail(
  p_actor      uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.participant_role;
  v_response   jsonb;
begin
  select pp.role
    into v_actor_role
    from public.promises p
    join public.promise_participants pp
      on pp.promise_id = p.id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where p.id = p_promise_id;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select jsonb_build_object(
           'promise_id', p.id,
           'title', p.title,
           'body', p.body,
           'category', p.category,
           'end_date', p.end_date,
           'keeper', p.keeper,
           'reward', p.reward,
           'penalty', p.penalty,
           'status', p.status,
           'checking_started_at', p.checking_started_at,
           'check_deadline_at', p.check_deadline_at,
           'check_round_no', p.check_round_no,
           'creator', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = p.id
                and pp.role = 'CREATOR'
                and pp.status = 'JOINED'
           ),
           'partner', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = p.id
                and pp.role = 'PARTNER'
                and pp.status = 'JOINED'
           ),
           'my_role', v_actor_role,
           'my_check', (
             select jsonb_build_object(
                      'role', pp.role,
                      'answer', fc.answer,
                      'comment', fc.comment,
                      'submitted_at', fc.submitted_at,
                      'revised_at', fc.revised_at,
                      'round_no', fc.round_no,
                      'evidences', public.lf_fulfillment_evidence_views(fc.id)
                    )
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
              where fc.promise_id = p.id
                and fc.user_id = p_actor
                and fc.round_no = p.check_round_no
           ),
           'creator_has_submitted', exists (
             select 1
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
                and pp.role = 'CREATOR'
                and pp.status = 'JOINED'
              where fc.promise_id = p.id
                and fc.round_no = p.check_round_no
           ),
           'partner_has_submitted', exists (
             select 1
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
                and pp.role = 'PARTNER'
                and pp.status = 'JOINED'
              where fc.promise_id = p.id
                and fc.round_no = p.check_round_no
           ),
           'partner_check', case
             when exists (
               select 1
                 from public.fulfillment_checks mine
                where mine.promise_id = p.id
                  and mine.user_id = p_actor
                  and mine.round_no = p.check_round_no
             )
             then (
               select jsonb_build_object(
                        'role', pp.role,
                        'answer', fc.answer,
                        'comment', fc.comment,
                        'submitted_at', fc.submitted_at,
                        'revised_at', fc.revised_at,
                        'round_no', fc.round_no,
                        'evidences', public.lf_fulfillment_evidence_views(fc.id)
                      )
                 from public.fulfillment_checks fc
                 join public.promise_participants pp
                   on pp.promise_id = fc.promise_id
                  and pp.user_id = fc.user_id
                  and pp.role in ('CREATOR', 'PARTNER')
                  and pp.status = 'JOINED'
                where fc.promise_id = p.id
                  and fc.user_id <> p_actor
                  and fc.round_no = p.check_round_no
             )
             else null
           end,
           'history', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'round_no', rounds.round_no,
                          'creator_check', (
                            select jsonb_build_object(
                                     'role', 'CREATOR',
                                     'answer', fc.answer,
                                     'comment', fc.comment,
                                     'submitted_at', fc.submitted_at,
                                     'revised_at', fc.revised_at,
                                     'round_no', fc.round_no,
                                     'evidences',
                                       public.lf_fulfillment_evidence_views(fc.id)
                                   )
                              from public.fulfillment_checks fc
                              join public.promise_participants pp
                                on pp.promise_id = fc.promise_id
                               and pp.user_id = fc.user_id
                               and pp.role = 'CREATOR'
                             where fc.promise_id = p.id
                               and fc.round_no = rounds.round_no
                          ),
                          'partner_check', (
                            select jsonb_build_object(
                                     'role', 'PARTNER',
                                     'answer', fc.answer,
                                     'comment', fc.comment,
                                     'submitted_at', fc.submitted_at,
                                     'revised_at', fc.revised_at,
                                     'round_no', fc.round_no,
                                     'evidences',
                                       public.lf_fulfillment_evidence_views(fc.id)
                                   )
                              from public.fulfillment_checks fc
                              join public.promise_participants pp
                                on pp.promise_id = fc.promise_id
                               and pp.user_id = fc.user_id
                               and pp.role = 'PARTNER'
                             where fc.promise_id = p.id
                               and fc.round_no = rounds.round_no
                          )
                        )
                        order by rounds.round_no
                      )
                 from (
                   select distinct fc.round_no
                     from public.fulfillment_checks fc
                    where fc.promise_id = p.id
                      and fc.round_no < p.check_round_no
                 ) rounds
             ),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promises p
   where p.id = p_promise_id;

  return v_response;
end;
$$;

revoke all on function public.lf_fulfillment_evidence_views(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_promise_fulfillment_detail(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_fulfillment_evidence_views(uuid)
  to service_role;
grant execute on function public.lf_promise_fulfillment_detail(uuid, uuid)
  to service_role;

create or replace function public.lf_evidence_sign_target(
  p_actor       uuid,
  p_evidence_id uuid,
  p_variant     text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  c_signed_seconds constant int := 600;
  v_evidence public.fulfillment_evidences%rowtype;
  v_check    public.fulfillment_checks%rowtype;
  v_promise  public.promises%rowtype;
  v_role     public.participant_role;
  v_key      text;
begin
  perform public.lf_assert_actor(p_actor);

  if p_variant not in ('FULL', 'THUMBNAIL') then
    raise exception 'E_VALIDATION';
  end if;

  select *
    into v_evidence
    from public.fulfillment_evidences fe
   where fe.id = p_evidence_id
     and fe.removed_at is null
     and fe.blinded_at is null
     and fe.purged_at is null;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select *
    into v_check
    from public.fulfillment_checks fc
   where fc.id = v_evidence.check_id;

  select *
    into v_promise
    from public.promises p
   where p.id = v_evidence.promise_id;

  select pp.role
    into v_role
    from public.promise_participants pp
   where pp.promise_id = v_evidence.promise_id
     and pp.user_id = p_actor
     and pp.status = 'JOINED'
     and pp.role in ('CREATOR', 'PARTNER', 'WITNESS');

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_role in ('CREATOR', 'PARTNER')
     and v_evidence.uploaded_by <> p_actor
     and v_check.round_no = v_promise.check_round_no
     and not exists (
       select 1
         from public.fulfillment_checks mine
        where mine.promise_id = v_evidence.promise_id
          and mine.user_id = p_actor
          and mine.round_no = v_check.round_no
     ) then
    raise exception 'E_NOT_FOUND';
  end if;

  v_key := case
    when p_variant = 'FULL' then v_evidence.storage_key
    else v_evidence.thumb_key
  end;

  if v_key is null then
    raise exception 'E_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'evidence_id', v_evidence.id,
    'bucket_id', 'fulfillment-evidences',
    'object_key', v_key,
    'variant', p_variant,
    'expires_in', c_signed_seconds
  );
end;
$$;

create or replace function public.lf_evidence_purge_targets(
  p_now   timestamptz default now(),
  p_limit int default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'evidences', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'evidence_id', targets.id,
                   'bucket_id', 'fulfillment-evidences',
                   'storage_key', targets.storage_key,
                   'thumb_key', targets.thumb_key
                 )
                 order by targets.id
               )
          from (
            select fe.id, fe.storage_key, fe.thumb_key
              from public.fulfillment_evidences fe
             where fe.purged_at is null
               and (
                 fe.removed_at is not null
                 or fe.purge_after < (p_now at time zone 'Asia/Seoul')::date
               )
             order by fe.id
             limit greatest(p_limit, 0)
          ) targets
      ),
      '[]'::jsonb
    ),
    'uploads', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'upload_id', targets.id,
                   'bucket_id', 'fulfillment-evidences',
                   'storage_key', targets.storage_key,
                   'thumb_key', targets.thumb_key
                 )
                 order by targets.id
               )
          from (
            select eu.id, eu.storage_key, eu.thumb_key
              from public.evidence_uploads eu
             where eu.status in ('PENDING', 'READY', 'DISCARDED', 'FAILED')
               and (
                 eu.status in ('DISCARDED', 'FAILED')
                 or eu.expires_at < p_now
               )
             order by eu.id
             limit greatest(p_limit, 0)
          ) targets
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.lf_evidence_purge_complete(
  p_evidence_ids uuid[],
  p_upload_ids   uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_evidence_count int;
  v_upload_count   int;
begin
  update public.fulfillment_evidences
     set purged_at = coalesce(purged_at, now())
   where id = any(coalesce(p_evidence_ids, '{}'::uuid[]))
     and purged_at is null;
  get diagnostics v_evidence_count = row_count;

  delete from public.evidence_uploads
   where id = any(coalesce(p_upload_ids, '{}'::uuid[]))
     and status in ('PENDING', 'READY', 'DISCARDED', 'FAILED');
  get diagnostics v_upload_count = row_count;

  return jsonb_build_object(
    'evidence_count', v_evidence_count,
    'upload_count', v_upload_count
  );
end;
$$;

revoke all on function public.lf_evidence_sign_target(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.lf_evidence_purge_targets(timestamptz, int)
  from public, anon, authenticated;
revoke all on function public.lf_evidence_purge_complete(uuid[], uuid[])
  from public, anon, authenticated;

grant execute on function public.lf_evidence_sign_target(uuid, uuid, text)
  to service_role;
grant execute on function public.lf_evidence_purge_targets(timestamptz, int)
  to service_role;
grant execute on function public.lf_evidence_purge_complete(uuid[], uuid[])
  to service_role;

create or replace function public.lf_set_terminal_evidence_retention()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status in ('COMPLETED', 'BROKEN', 'UNRESOLVED')
     and old.status is distinct from new.status then
    update public.fulfillment_evidences
       set purge_after =
             (
               coalesce(new.closed_at, now()) at time zone 'Asia/Seoul'
             )::date + 365
     where promise_id = new.id
       and purge_after is null;
  end if;
  return new;
end;
$$;

drop trigger if exists fulfillment_evidence_retention
  on public.promises;
create trigger fulfillment_evidence_retention
after update of status on public.promises
for each row execute function public.lf_set_terminal_evidence_retention();

revoke all on function public.lf_set_terminal_evidence_retention()
  from public, anon, authenticated;
grant execute on function public.lf_set_terminal_evidence_retention()
  to service_role;

-- PGlite에는 Storage 스키마가 없으므로 실제 Supabase에서만 비공개 버킷을 보정한다.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
      )
      values (
        'fulfillment-evidences',
        'fulfillment-evidences',
        false,
        5242880,
        array['image/jpeg']::text[]
      )
      on conflict (id) do update
        set public = false,
            file_size_limit = excluded.file_size_limit,
            allowed_mime_types = excluded.allowed_mime_types
    $storage$;
  end if;
end;
$$;

-- J-08: 일요일 05:00 KST. 같은 함수를 다시 호출해도 잡은 한 건만 남는다.
create or replace function public.lf_schedule_evidence_purge()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;

  select jobid
    into v_job_id
    from cron.job
   where jobname = 'lf-evidence-purge';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'lf-evidence-purge',
    '0 20 * * 6',
    $command$
      select net.http_post(
        url := (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'evidence_purge_url'
           limit 1
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-evidence-purge-secret', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'evidence_purge_secret'
             limit 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $command$
  );
end;
$$;

revoke all on function public.lf_schedule_evidence_purge()
  from public, anon, authenticated;
grant execute on function public.lf_schedule_evidence_purge()
  to service_role;

select public.lf_schedule_evidence_purge();
