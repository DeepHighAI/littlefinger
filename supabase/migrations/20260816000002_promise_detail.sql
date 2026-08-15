-- SCR-A05 participant-only promise detail snapshot.
-- 읽기 함수도 존재 은닉과 전략적 후행 응답 방지를 서버에서 강제한다.

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
           'version_no', v.version_no,
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

create or replace function public.lf_promise_detail_check_json(
  p_check_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
   where fc.id = p_check_id;
$$;

create or replace function public.lf_promise_detail(
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

  select *
    into strict v_version
    from public.promise_versions
   where id = v_promise.current_version_id
     and promise_id = v_promise.id;

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

revoke all on function public.lf_promise_detail_version_json(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.lf_promise_detail_check_json(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.lf_promise_detail(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_promise_detail(uuid, uuid)
  to service_role;

comment on function public.lf_promise_detail(uuid, uuid) is
  'SCR-A05 participant-only snapshot. Private audit/storage fields and strategic CHECKING answers are excluded.';
