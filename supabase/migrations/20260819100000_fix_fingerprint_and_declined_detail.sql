-- E2E Run 1 (2026-08-19) findings F1·F2 fix.
--
-- F1: lf_promise_detail_version_json 이 지문 세 번째 그룹을 해시 9~10번째 문자로 만들었다.
--     정본은 lf_fingerprint(hash, version_no) — 확정 화면(promise_approve)이 이미 그 형식으로
--     인쇄했으므로, 상세·버전 이력이 다른 형식을 쓰면 같은 기록의 지문이 영원히 불일치한다.
-- F2: lf_promise_detail 이 current_version_id 로 strict 조회하는데, 이 컬럼은 promise_approve
--     만 기록한다. 승인 전에 끝난 약속(DECLINED·T-18)은 NULL 이라 NO_DATA_FOUND 가 셸에서
--     E_INTERNAL(500) 로 평탄화됐다 — 거절된 약속 카드는 항상 상세 조회에 실패했다.

-- ============================================================
-- F1 — 버전 JSON 의 지문을 정본 생성기로
-- ============================================================

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
           -- 지문은 반드시 확정 화면과 같은 함수로 만든다. 제안본은 위와 같은 규칙으로
           -- "활성화되면 받을 번호"를 미리 보여준다.
           'fingerprint', public.lf_fingerprint(
             v.content_hash,
             coalesce(
               v.version_no,
               (select coalesce(max(numbered.version_no), 0) + 1
                  from public.promise_versions numbered
                 where numbered.promise_id = v.promise_id
                   and numbered.version_no is not null)
             )
           ),
           'activated_at', v.activated_at,
           'superseded_at', v.superseded_at,
           'change_reason', v.change_reason
         )
    from public.promise_versions v
   where v.id = p_version_id;
$$;

-- ============================================================
-- F2 — 승인 전 종결(DECLINED)에도 상세가 열리도록
-- ============================================================
-- 주의: 0818 마이그레이션이 원본을 lf_promise_detail_core 로 개명하고 같은 이름의
-- wrapper(counterpart_push_available 부가)를 새로 만들었다. 여기서 고치는 것은 core 다 —
-- wrapper 이름으로 replace 하면 wrapper 가 통째로 사라진다.

create or replace function public.lf_promise_detail_core(
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
  v_promise        public.promises%rowtype;
  v_version        public.promise_versions%rowtype;
  v_actor_role     public.participant_role;
  v_can_view_check boolean := false;
  v_response       jsonb;
begin
  -- 존재 여부보다 참여 자격을 먼저 확인해 외부인에게 약속 자체를 숨긴다.
  select pp.role
    into v_actor_role
    from public.promises p
    join public.promise_participants pp
      on pp.promise_id = p.id
     and pp.user_id = p_actor
     and (
       pp.status = 'JOINED'
       or (p.status = 'DECLINED' and pp.status = 'DECLINED')
     )
   where p.id = p_promise_id
     and not (p.hidden_by ? p_actor::text);

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select *
    into strict v_promise
    from public.promises
   where id = p_promise_id;

  if v_promise.status = 'DRAFT' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_promise.current_version_id is not null then
    select *
      into strict v_version
      from public.promise_versions
     where id = v_promise.current_version_id
       and promise_id = v_promise.id;
  else
    -- current_version_id 는 promise_approve 만 기록한다. 승인 전에 끝난 약속(DECLINED)은
    -- NULL 이므로 번호가 있는 최신 버전으로 대신 읽는다. 제안본(version_no null)은 현재
    -- 전문이 될 수 없어 제외한다. 여기서도 없으면 데이터 손상이라 strict 로 500 이 맞다.
    select *
      into strict v_version
      from public.promise_versions
     where promise_id = v_promise.id
       and version_no is not null
     order by version_no desc
     limit 1;
  end if;

  v_can_view_check :=
    v_promise.status <> 'CHECKING'
    or (
      v_actor_role in ('CREATOR', 'PARTNER')
      and exists (
        select 1
          from public.fulfillment_checks mine
         where mine.promise_id = v_promise.id
           and mine.user_id = p_actor
           and mine.round_no = v_promise.check_round_no
      )
    );

  select jsonb_build_object(
           'promise_id', v_promise.id,
           'status', v_promise.status,
           -- 전문은 조회 캐시가 아니라 append-only 현재 버전에서 읽는다.
           'title', v_version.title,
           'body', v_version.body,
           'category', v_version.category,
           'end_date', v_version.end_date,
           'keeper', v_version.keeper,
           'reward', v_version.reward,
           'penalty', v_version.penalty,
           'witness_enabled', v_promise.witness_enabled,
           'activated_at', v_promise.activated_at,
           'closed_at', v_promise.closed_at,
           'checking_started_at', v_promise.checking_started_at,
           'check_deadline_at', v_promise.check_deadline_at,
           'check_round_no', v_promise.check_round_no,
           'my_role', v_actor_role,
           'creator', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url,
                      'role', pp.role,
                      'status', pp.status,
                      'joined_at', pp.joined_at
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = v_promise.id
                and pp.role = 'CREATOR'
              order by pp.id
              limit 1
           ),
           'partner', (
             select jsonb_build_object(
                      'user_id', u.id,
                      'nickname', u.nickname,
                      'profile_image_url', u.profile_image_url,
                      'role', pp.role,
                      'status', pp.status,
                      'joined_at', pp.joined_at
                    )
               from public.promise_participants pp
               join public.users u on u.id = pp.user_id
              where pp.promise_id = v_promise.id
                and pp.role = 'PARTNER'
                and pp.user_id is not null
              order by pp.id
              limit 1
           ),
           'witnesses', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'user_id', u.id,
                          'nickname', u.nickname,
                          'profile_image_url', u.profile_image_url,
                          'role', pp.role,
                          'status', pp.status,
                          'joined_at', pp.joined_at
                        )
                        order by pp.joined_at nulls last, pp.id
                      )
                 from public.promise_participants pp
                 join public.users u on u.id = pp.user_id
                where pp.promise_id = v_promise.id
                  and pp.role = 'WITNESS'
                  and pp.status = 'JOINED'
             ),
             '[]'::jsonb
           ),
           'approvals', coalesce(
             (
               select jsonb_agg(
                        jsonb_build_object(
                          'role', a.role,
                          'action', a.action,
                          'actor', jsonb_build_object(
                            'user_id', u.id,
                            'nickname', u.nickname,
                            'profile_image_url', u.profile_image_url
                          ),
                          'acted_at', a.acted_at,
                          'comment', a.comment
                        )
                        order by a.acted_at, a.id
                      )
                 from public.approvals a
                 join public.users u on u.id = a.user_id
                where a.promise_id = v_promise.id
             ),
             '[]'::jsonb
           ),
           'current_version', public.lf_promise_detail_version_json(v_version.id),
           'invitation', case
             when v_promise.status = 'PENDING' then (
               select jsonb_build_object(
                        'status', i.status,
                        'expires_at', i.expires_at,
                        'resend_count', i.resend_count
                      )
                 from public.invitations i
                where i.promise_id = v_promise.id
                  and i.target_role = 'PARTNER'
                order by i.created_at desc, i.id desc
                limit 1
             )
             else null
           end,
           'amend_request', case
             when v_promise.status in ('AMEND_PENDING', 'CANCELED') then (
               select jsonb_build_object(
                        'request_id', ar.id,
                        'type', ar.type,
                        'status', ar.status,
                        'requester', jsonb_build_object(
                          'user_id', u.id,
                          'nickname', u.nickname,
                          'profile_image_url', u.profile_image_url
                        ),
                        'reason', ar.reason,
                        'created_at', ar.created_at,
                        'expires_at', ar.expires_at,
                        'proposed_version', case
                          when ar.proposed_version_id is null then null
                          else public.lf_promise_detail_version_json(ar.proposed_version_id)
                        end
                      )
                 from public.amend_requests ar
                 join public.users u on u.id = ar.requester_id
                where ar.promise_id = v_promise.id
                  and (
                    (v_promise.status = 'AMEND_PENDING' and ar.status = 'PENDING')
                    or (
                      v_promise.status = 'CANCELED'
                      and ar.type = 'CANCEL'
                      and ar.status = 'APPROVED'
                    )
                  )
                order by ar.created_at desc, ar.id desc
                limit 1
             )
             else null
           end,
           'fulfillment', case
             when v_promise.status in (
               'CHECKING', 'COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED'
             ) then jsonb_build_object(
               'round_no', v_promise.check_round_no,
               'creator_has_submitted', exists (
                 select 1
                   from public.fulfillment_checks fc
                   join public.promise_participants pp
                     on pp.promise_id = fc.promise_id
                    and pp.user_id = fc.user_id
                    and pp.role = 'CREATOR'
                  where fc.promise_id = v_promise.id
                    and fc.round_no = v_promise.check_round_no
               ),
               'partner_has_submitted', exists (
                 select 1
                   from public.fulfillment_checks fc
                   join public.promise_participants pp
                     on pp.promise_id = fc.promise_id
                    and pp.user_id = fc.user_id
                    and pp.role = 'PARTNER'
                  where fc.promise_id = v_promise.id
                    and fc.round_no = v_promise.check_round_no
               ),
               'creator_check', case when v_can_view_check then (
                 select public.lf_promise_detail_check_json(fc.id)
                   from public.fulfillment_checks fc
                   join public.promise_participants pp
                     on pp.promise_id = fc.promise_id
                    and pp.user_id = fc.user_id
                    and pp.role = 'CREATOR'
                  where fc.promise_id = v_promise.id
                    and fc.round_no = v_promise.check_round_no
                  limit 1
               ) else null end,
               'partner_check', case when v_can_view_check then (
                 select public.lf_promise_detail_check_json(fc.id)
                   from public.fulfillment_checks fc
                   join public.promise_participants pp
                     on pp.promise_id = fc.promise_id
                    and pp.user_id = fc.user_id
                    and pp.role = 'PARTNER'
                  where fc.promise_id = v_promise.id
                    and fc.round_no = v_promise.check_round_no
                  limit 1
               ) else null end,
               'history', coalesce(
                 (
                   select jsonb_agg(
                            jsonb_build_object(
                              'round_no', rounds.round_no,
                              'creator_check', (
                                select public.lf_promise_detail_check_json(fc.id)
                                  from public.fulfillment_checks fc
                                  join public.promise_participants pp
                                    on pp.promise_id = fc.promise_id
                                   and pp.user_id = fc.user_id
                                   and pp.role = 'CREATOR'
                                 where fc.promise_id = v_promise.id
                                   and fc.round_no = rounds.round_no
                                 limit 1
                              ),
                              'partner_check', (
                                select public.lf_promise_detail_check_json(fc.id)
                                  from public.fulfillment_checks fc
                                  join public.promise_participants pp
                                    on pp.promise_id = fc.promise_id
                                   and pp.user_id = fc.user_id
                                   and pp.role = 'PARTNER'
                                 where fc.promise_id = v_promise.id
                                   and fc.round_no = rounds.round_no
                                 limit 1
                              )
                            )
                            order by rounds.round_no
                          )
                     from (
                       select distinct fc.round_no
                         from public.fulfillment_checks fc
                        where fc.promise_id = v_promise.id
                          and fc.round_no < v_promise.check_round_no
                     ) rounds
                 ),
                 '[]'::jsonb
               )
             )
             else null
           end,
           'integrity_status', case
             when v_promise.status in ('PENDING', 'DECLINED') then 'UNVERIFIED'
             when public.lf_content_hash(
                    v_version.title,
                    v_version.body,
                    v_version.category,
                    v_version.end_date,
                    v_version.keeper,
                    v_version.reward,
                    v_version.penalty,
                    v_version.version_no
                  ) = v_version.content_hash then 'VERIFIED'
             else 'FAILED'
           end
         )
    into v_response;

  return v_response;
end;
$$;

-- create or replace 는 기존 ACL 을 보존하지만, 서버 전용 3중 revoke 는 이 프로젝트의
-- 감사 기준선이라 명시적으로 다시 못박는다. wrapper(lf_promise_detail)의 grant 는 0818 이
-- 이미 세웠고 여기서 건드리지 않는다.
revoke all on function public.lf_promise_detail_version_json(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.lf_promise_detail_core(uuid, uuid)
  from public, anon, authenticated, service_role;
