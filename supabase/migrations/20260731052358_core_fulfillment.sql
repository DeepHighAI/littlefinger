-- F-07 핵심 이행 확인 — 참여 목록·상세·응답 판정·신뢰 프로필.
--
-- J-02 CHECKING 진입, J-03 기한 종결, DISPUTED 재협의는 다음 마이그레이션의 소유 범위다.
-- 이 파일은 이미 CHECKING인 약속에서 양측 응답을 한 트랜잭션으로 직렬화하고, 두 번째
-- 응답이 T-12/T-13/T-14 결과를 한 번만 기록하도록 한다.

-- ============================================================
-- 참여 약속 목록
-- ============================================================

create or replace function public.lf_participant_promise_list(p_actor uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(items)
      order by items.needs_response desc,
               items.check_deadline_at asc nulls last,
               items.updated_at desc
    ),
    '[]'::jsonb
  )
  from (
    select p.id as promise_id,
           p.title,
           p.status,
           p.end_date,
           p.keeper,
           p.updated_at,
           p.check_deadline_at,
           p.check_round_no,
           (
             p.status = 'CHECKING'
             and not exists (
               select 1
                 from public.fulfillment_checks mine
                where mine.promise_id = p.id
                  and mine.user_id = p_actor
                  and mine.round_no = p.check_round_no
             )
           ) as needs_response,
           (
             p.status = 'CHECKING'
             and exists (
               select 1
                 from public.fulfillment_checks mine
                where mine.promise_id = p.id
                  and mine.user_id = p_actor
                  and mine.round_no = p.check_round_no
             )
             and not exists (
               select 1
                 from public.fulfillment_checks counterpart
                 join public.promise_participants counterpart_participant
                   on counterpart_participant.promise_id = counterpart.promise_id
                  and counterpart_participant.user_id = counterpart.user_id
                  and counterpart_participant.role in ('CREATOR', 'PARTNER')
                  and counterpart_participant.status = 'JOINED'
                where counterpart.promise_id = p.id
                  and counterpart.user_id <> p_actor
                  and counterpart.round_no = p.check_round_no
             )
           ) as waiting_for_partner
      from public.promises p
      join public.promise_participants actor_participant
        on actor_participant.promise_id = p.id
       and actor_participant.user_id = p_actor
       and actor_participant.role in ('CREATOR', 'PARTNER')
       and actor_participant.status = 'JOINED'
     where p.status in (
       'ACTIVE', 'AMEND_PENDING', 'CHECKING', 'COMPLETED', 'BROKEN',
       'DISPUTED', 'UNRESOLVED', 'CANCELED', 'DECLINED'
     )
       and not (p.hidden_by ? p_actor::text)
  ) items;
$$;

comment on function public.lf_participant_promise_list is
  'JOINED 작성자·상대방의 F-07 목록. 숨김과 DRAFT/PENDING은 제외하고 응답 필요를 먼저 반환한다.';

-- ============================================================
-- 이행 상세
-- ============================================================

create or replace function public.lf_promise_fulfillment_detail(
  p_actor      uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_actor_role public.participant_role;
  v_round_no   int;
  v_response   jsonb;
begin
  select pp.role, p.check_round_no
    into v_actor_role, v_round_no
    from public.promises p
    join public.promise_participants pp
      on pp.promise_id = p.id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where p.id = p_promise_id;

  -- 미수락 행과 비참여자는 약속 존재 여부조차 구분할 수 없다.
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
           'my_check', (
             select jsonb_build_object(
                      'role', pp.role,
                      'answer', fc.answer,
                      'comment', fc.comment,
                      'submitted_at', fc.submitted_at,
                      'revised_at', fc.revised_at,
                      'round_no', fc.round_no
                    )
               from public.fulfillment_checks fc
               join public.promise_participants pp
                 on pp.promise_id = fc.promise_id
                and pp.user_id = fc.user_id
              where fc.promise_id = p.id
                and fc.user_id = p_actor
                and fc.round_no = p.check_round_no
           ),
           'partner_has_submitted', exists (
             select 1
               from public.fulfillment_checks fc
              where fc.promise_id = p.id
                and fc.user_id <> p_actor
                and fc.round_no = p.check_round_no
           ),
           -- 현재 라운드의 상대 주장은 호출자도 제출한 뒤에만 서로 공개한다.
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
                        'round_no', fc.round_no
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
                                     'round_no', fc.round_no
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
                                     'round_no', fc.round_no
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

comment on function public.lf_promise_fulfillment_detail is
  'JOINED 작성자·상대방 전용 상세. 현재 상대 주장은 호출자 제출 전까지 숨기고 과거 라운드는 대등하게 공개한다.';

-- ============================================================
-- 신뢰 프로필
-- ============================================================

create or replace function public.lf_trust_min_sample()
returns int
language sql
immutable
as $$
  select 3;
$$;

create or replace function public.lf_recompute_trust_profile(p_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_completed  int;
  v_broken     int;
  v_disputed   int;
  v_unresolved int;
  v_active     int;
  v_keep_rate  int;
  v_response   jsonb;
begin
  select count(*) filter (
           where p.status = 'COMPLETED'
             and (
               (pp.role = 'CREATOR' and p.keeper in ('CREATOR', 'BOTH'))
               or (pp.role = 'PARTNER' and p.keeper in ('PARTNER', 'BOTH'))
             )
         )::int,
         count(*) filter (
           where p.status = 'BROKEN'
             and (
               (pp.role = 'CREATOR' and p.keeper in ('CREATOR', 'BOTH'))
               or (pp.role = 'PARTNER' and p.keeper in ('PARTNER', 'BOTH'))
             )
         )::int,
         count(*) filter (where p.status = 'DISPUTED')::int,
         count(*) filter (where p.status = 'UNRESOLVED')::int,
         count(*) filter (where p.status in ('ACTIVE', 'AMEND_PENDING', 'CHECKING'))::int
    into v_completed, v_broken, v_disputed, v_unresolved, v_active
    from public.promise_participants pp
    join public.promises p on p.id = pp.promise_id
   where pp.user_id = p_user_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if v_completed + v_broken < public.lf_trust_min_sample() then
    v_keep_rate := null;
  else
    v_keep_rate := round(v_completed * 100.0 / (v_completed + v_broken))::int;
  end if;

  insert into public.trust_profiles (
    user_id, completed_count, broken_count, disputed_count, unresolved_count,
    active_count, keep_rate, updated_at
  )
  values (
    p_user_id, v_completed, v_broken, v_disputed, v_unresolved,
    v_active, v_keep_rate, now()
  )
  on conflict (user_id) do update
    set completed_count = excluded.completed_count,
        broken_count = excluded.broken_count,
        disputed_count = excluded.disputed_count,
        unresolved_count = excluded.unresolved_count,
        active_count = excluded.active_count,
        keep_rate = excluded.keep_rate,
        updated_at = now()
  returning to_jsonb(trust_profiles) into v_response;

  return v_response;
end;
$$;

comment on function public.lf_recompute_trust_profile is
  'F-09 지킴율 캐시 재계산. keeper 역할을 모수에 적용하고 DISPUTED/UNRESOLVED는 별도 집계한다.';

-- ============================================================
-- 응답 제출·정정·T-12/T-13/T-14
-- ============================================================

create or replace function public.lf_fulfillment_submit(
  p_idempotency_key uuid,
  p_actor          uuid,
  p_promise_id     uuid,
  p_answer         public.fulfillment_answer,
  p_comment        text,
  p_revise         boolean,
  p_surface        public.surface
)
returns jsonb
language plpgsql
as $$
declare
  c_comment_max constant int := 200;
  v_cached          jsonb;
  v_promise         public.promises%rowtype;
  v_actor_role      public.participant_role;
  v_actor_check_id  uuid;
  v_actor_submitted timestamptz;
  v_actor_revised   timestamptz;
  v_other_check_id  uuid;
  v_other_answer    public.fulfillment_answer;
  v_comment         text := nullif(public.lf_normalize_input(p_comment), '');
  v_result          public.promise_status := 'CHECKING';
  v_response        jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'fulfillment-submit'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  -- 모든 응답·정정은 같은 약속 행을 먼저 잠근다. 두 번째 트랜잭션만 두 응답을 보고
  -- 판정하며, 이후 요청은 종결 상태를 읽고 실패한다.
  select *
    into v_promise
    from public.promises
   where id = p_promise_id
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
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

  if v_promise.status <> 'CHECKING'
     or v_promise.check_deadline_at is null
     or v_promise.check_deadline_at <= now() then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if char_length(coalesce(v_comment, '')) > c_comment_max then
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
    if coalesce(p_revise, false) then
      raise exception 'E_STATE_CONFLICT';
    end if;

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
    if not coalesce(p_revise, false)
       or v_actor_revised is not null
       or v_other_check_id is not null then
      raise exception 'E_STATE_CONFLICT';
    end if;

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
    end if;

    perform public.lf_recompute_trust_profile(pp.user_id)
      from public.promise_participants pp
     where pp.promise_id = p_promise_id
       and pp.role in ('CREATOR', 'PARTNER')
       and pp.status = 'JOINED';

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

comment on function public.lf_fulfillment_submit is
  'F-07 응답 제출·1회 정정과 T-12/T-13/T-14 판정을 한 트랜잭션에서 수행한다.';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

revoke all on function public.lf_participant_promise_list(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_promise_fulfillment_detail(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.lf_trust_min_sample()
  from public, anon, authenticated;
revoke all on function public.lf_recompute_trust_profile(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_fulfillment_submit(
  uuid, uuid, uuid, public.fulfillment_answer, text, boolean, public.surface
) from public, anon, authenticated;

grant execute on function public.lf_participant_promise_list(uuid) to service_role;
grant execute on function public.lf_promise_fulfillment_detail(uuid, uuid) to service_role;
grant execute on function public.lf_trust_min_sample() to service_role;
grant execute on function public.lf_recompute_trust_profile(uuid) to service_role;
grant execute on function public.lf_fulfillment_submit(
  uuid, uuid, uuid, public.fulfillment_answer, text, boolean, public.surface
) to service_role;
