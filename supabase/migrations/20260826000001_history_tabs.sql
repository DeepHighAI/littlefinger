-- SCR-A09 지난 약속 히스토리 (PO 2026-08-26, ADR 0011).
--
-- 홈은 ACTIVE·WAITING 두 탭만 남기고, 종결 약속은 히스토리 화면의 네 탭으로 옮긴다:
--   DONE(완료) · BROKEN(불이행) · UNSETTLED(의견 불일치·미확정 종결) · DECLINED(거절·파기).
-- DISPUTED 를 '불이행'으로 묶지 않는 분리는 P1(판정하지 않는다)의 요구다.
--
-- **구버전 앱 호환이 이 재정의의 제약이다.** 설치된 빌드의 파서는 counts 를
-- {ACTIVE, WAITING, COMPLETED} 정확 3키로 검사하므로, 레거시 탭 요청의 응답은 바이트
-- 단위로 기존과 같아야 한다 — 새 4키 counts 는 히스토리 탭 요청에만 싣는다.
-- COMPLETED 탭 자체도 그대로 남는다(구버전이 계속 부른다).

create or replace function public.lf_promise_home_list(
  p_actor uuid,
  p_tab text,
  p_cursor jsonb default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := 20;
  -- 종결 계열 탭(COMPLETED + 히스토리 4종)은 커서·정렬 규칙을 공유한다.
  v_terminal boolean;
  v_history boolean;
  v_cursor_rank integer;
  v_cursor_end_date date;
  v_cursor_updated_at timestamptz;
  v_cursor_closed_at timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
begin
  if p_actor is null then
    raise exception 'E_UNAUTHORIZED';
  end if;
  if p_tab not in ('ACTIVE', 'WAITING', 'COMPLETED', 'DONE', 'BROKEN', 'UNSETTLED', 'DECLINED') then
    raise exception 'E_VALIDATION';
  end if;
  v_history := p_tab in ('DONE', 'BROKEN', 'UNSETTLED', 'DECLINED');
  v_terminal := p_tab not in ('ACTIVE', 'WAITING');

  if p_cursor is not null then
    if p_cursor->>'tab' is distinct from p_tab then
      raise exception 'E_VALIDATION';
    end if;
    v_cursor_id := (p_cursor->>'promise_id')::uuid;
    if p_tab = 'ACTIVE' then
      v_cursor_rank := (p_cursor->>'status_rank')::integer;
      v_cursor_end_date := (p_cursor->>'end_date')::date;
      if v_cursor_rank not in (0, 1) then raise exception 'E_VALIDATION'; end if;
    elsif p_tab = 'WAITING' then
      v_cursor_updated_at := (p_cursor->>'updated_at')::timestamptz;
    else
      v_cursor_updated_at := (p_cursor->>'updated_at')::timestamptz;
      if p_cursor->'closed_at' <> 'null'::jsonb then
        v_cursor_closed_at := (p_cursor->>'closed_at')::timestamptz;
      end if;
    end if;
  end if;

  with visible as materialized (
    select p.id,
           p.status,
           p.title,
           p.end_date,
           p.updated_at,
           p.closed_at,
           p.check_round_no,
           p.check_deadline_at,
           actor_participant.role as my_role,
           case
             when p.status in ('ACTIVE', 'AMEND_PENDING', 'CHECKING') then 'ACTIVE'
             when p.status in ('DRAFT', 'PENDING') then 'WAITING'
             else 'COMPLETED'
           end as tab_key,
           -- 히스토리 4분류. 비종결 상태는 NULL 이라 어느 히스토리 탭에도 걸리지 않는다.
           case
             when p.status = 'COMPLETED' then 'DONE'
             when p.status = 'BROKEN' then 'BROKEN'
             when p.status in ('DISPUTED', 'UNRESOLVED') then 'UNSETTLED'
             when p.status in ('DECLINED', 'CANCELED') then 'DECLINED'
             else null
           end as history_key,
           case when p.status = 'CHECKING' then 0 else 1 end as status_rank,
           (
             p.status = 'CHECKING'
             or (
               p.status = 'ACTIVE'
               and p.end_date - (p_now at time zone 'Asia/Seoul')::date between 0 and 3
             )
           ) as is_pinned,
           (
             p.status = 'CHECKING'
             and actor_participant.role in ('CREATOR', 'PARTNER')
             and not exists (
               select 1
                 from public.fulfillment_checks mine
                where mine.promise_id = p.id
                  and mine.user_id = p_actor
                  and mine.round_no = p.check_round_no
             )
           ) as needs_response,
           jsonb_build_object(
             'promise_id', p.id,
             'title', p.title,
             'status', p.status,
             'end_date', p.end_date,
             'updated_at', p.updated_at,
             'closed_at', p.closed_at,
             'my_role', actor_participant.role,
             'creator', jsonb_build_object(
               'nickname', creator.nickname,
               'profile_image_url', creator.profile_image_url
             ),
             'partner', case
               when partner.user_id is null then null
               else jsonb_build_object(
                 'nickname', partner.nickname,
                 'profile_image_url', partner.profile_image_url
               )
             end,
             'has_witness', exists (
               select 1
                 from public.promise_participants witness
                where witness.promise_id = p.id
                  and witness.role = 'WITNESS'
                  and witness.status = 'JOINED'
                  and witness.user_id is not null
             ),
             'needs_response', (
               p.status = 'CHECKING'
               and actor_participant.role in ('CREATOR', 'PARTNER')
               and not exists (
                 select 1
                   from public.fulfillment_checks mine
                  where mine.promise_id = p.id
                    and mine.user_id = p_actor
                    and mine.round_no = p.check_round_no
               )
             )
           ) as card
      from public.promises p
      join public.promise_participants actor_participant
        on actor_participant.promise_id = p.id
       and actor_participant.user_id = p_actor
       and actor_participant.status = 'JOINED'
      join public.users creator on creator.id = p.creator_id
      left join lateral (
        select participant.user_id, partner_user.nickname, partner_user.profile_image_url
          from public.promise_participants participant
          join public.users partner_user on partner_user.id = participant.user_id
         where participant.promise_id = p.id
           and participant.role = 'PARTNER'
           and participant.status = 'JOINED'
         limit 1
      ) partner on true
     where p.status in (
       'DRAFT', 'PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING',
       'COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED'
     )
       and not (p.hidden_by ? p_actor::text)
       and (
         p.status not in ('DRAFT', 'PENDING')
         or (p.creator_id = p_actor and actor_participant.role = 'CREATOR')
       )
  ),
  eligible as materialized (
    select *
      from visible
     where case when v_history then history_key else tab_key end = p_tab
       and not is_pinned
       and (
         p_cursor is null
         or case
           when p_tab = 'ACTIVE' then
             status_rank > v_cursor_rank
             or (
               status_rank = v_cursor_rank
               and (
                 end_date > v_cursor_end_date
                 or (end_date = v_cursor_end_date and id > v_cursor_id)
               )
             )
           when p_tab = 'WAITING' then
             updated_at < v_cursor_updated_at
             or (updated_at = v_cursor_updated_at and id < v_cursor_id)
           else
             case
               when v_cursor_closed_at is null then
                 closed_at is null
                 and (
                   updated_at < v_cursor_updated_at
                   or (updated_at = v_cursor_updated_at and id < v_cursor_id)
                 )
               else
                 closed_at is null
                 or closed_at < v_cursor_closed_at
                 or (
                   closed_at = v_cursor_closed_at
                   and (
                     updated_at < v_cursor_updated_at
                     or (updated_at = v_cursor_updated_at and id < v_cursor_id)
                   )
                 )
             end
         end
       )
  ),
  page_source as materialized (
    select *
      from eligible
     order by
       case when p_tab = 'ACTIVE' then status_rank end asc nulls last,
       case when p_tab = 'ACTIVE' then end_date end asc nulls last,
       case when p_tab = 'WAITING' then updated_at end desc nulls last,
       case when v_terminal then (closed_at is null)::integer end asc nulls last,
       case when v_terminal then closed_at end desc nulls last,
       case when v_terminal then updated_at end desc nulls last,
       case when p_tab = 'ACTIVE' then id end asc nulls last,
       case when p_tab <> 'ACTIVE' then id end desc nulls last
     limit v_limit + 1
  ),
  returned as materialized (
    select *
      from page_source
     order by
       case when p_tab = 'ACTIVE' then status_rank end asc nulls last,
       case when p_tab = 'ACTIVE' then end_date end asc nulls last,
       case when p_tab = 'WAITING' then updated_at end desc nulls last,
       case when v_terminal then (closed_at is null)::integer end asc nulls last,
       case when v_terminal then closed_at end desc nulls last,
       case when v_terminal then updated_at end desc nulls last,
       case when p_tab = 'ACTIVE' then id end asc nulls last,
       case when p_tab <> 'ACTIVE' then id end desc nulls last
     limit v_limit
  )
  select jsonb_build_object(
           'items', coalesce(
             (
               select jsonb_agg(
                        card
                        order by
                          case when p_tab = 'ACTIVE' then status_rank end asc nulls last,
                          case when p_tab = 'ACTIVE' then end_date end asc nulls last,
                          case when p_tab = 'WAITING' then updated_at end desc nulls last,
                          case when v_terminal then (closed_at is null)::integer end asc nulls last,
                          case when v_terminal then closed_at end desc nulls last,
                          case when v_terminal then updated_at end desc nulls last,
                          case when p_tab = 'ACTIVE' then id end asc nulls last,
                          case when p_tab <> 'ACTIVE' then id end desc nulls last
                      )
                 from returned
             ),
             '[]'::jsonb
           ),
           'pinned', case
             when p_tab <> 'ACTIVE' then '[]'::jsonb
             else coalesce(
               (
                 select jsonb_agg(
                          card
                          order by status_rank asc, needs_response desc, end_date asc, id asc
                        )
                   from visible
                  where tab_key = 'ACTIVE' and is_pinned
               ),
               '[]'::jsonb
             )
           end,
           -- 구버전 파서는 3키 정확 일치를 검사한다 — 레거시 탭 응답은 그대로,
           -- 히스토리 탭 응답만 4키를 싣는다.
           'counts', case
             when v_history then jsonb_build_object(
               'DONE', (select count(*) from visible where history_key = 'DONE'),
               'BROKEN', (select count(*) from visible where history_key = 'BROKEN'),
               'UNSETTLED', (select count(*) from visible where history_key = 'UNSETTLED'),
               'DECLINED', (select count(*) from visible where history_key = 'DECLINED')
             )
             else jsonb_build_object(
               'ACTIVE', (select count(*) from visible where tab_key = 'ACTIVE'),
               'WAITING', (select count(*) from visible where tab_key = 'WAITING'),
               'COMPLETED', (select count(*) from visible where tab_key = 'COMPLETED')
             )
           end,
           'next_cursor', case
             when (select count(*) from page_source) <= v_limit then null
             else (
               select case
                 when p_tab = 'ACTIVE' then jsonb_build_object(
                   'tab', 'ACTIVE',
                   'status_rank', status_rank,
                   'end_date', end_date,
                   'promise_id', id
                 )
                 when p_tab = 'WAITING' then jsonb_build_object(
                   'tab', 'WAITING',
                   'updated_at', updated_at,
                   'promise_id', id
                 )
                 else jsonb_build_object(
                   'tab', p_tab,
                   'closed_at', closed_at,
                   'updated_at', updated_at,
                   'promise_id', id
                 )
               end
                 from returned
                order by
                  case when p_tab = 'ACTIVE' then status_rank end asc nulls last,
                  case when p_tab = 'ACTIVE' then end_date end asc nulls last,
                  case when p_tab = 'WAITING' then updated_at end desc nulls last,
                  case when v_terminal then (closed_at is null)::integer end asc nulls last,
                  case when v_terminal then closed_at end desc nulls last,
                  case when v_terminal then updated_at end desc nulls last,
                  case when p_tab = 'ACTIVE' then id end asc nulls last,
                  case when p_tab <> 'ACTIVE' then id end desc nulls last
                offset (v_limit - 1)
                limit 1
             )
           end
         )
    into v_result;

  return v_result;
exception
  when invalid_text_representation or datetime_field_overflow then
    raise exception 'E_VALIDATION';
end;
$$;

comment on function public.lf_promise_home_list(uuid, text, jsonb, timestamptz) is
  'SCR-A02 탭별 20건 목록·ACTIVE 임박 고정 + SCR-A09 히스토리 4탭(ADR 0011). actor는 검증된 JWT에서만 전달한다.';

-- create or replace 는 기존 ACL 을 보존하지만 3중 revoke 는 감사 기준선이라 다시 못박는다.
revoke all on function public.lf_promise_home_list(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.lf_promise_home_list(uuid, text, jsonb, timestamptz) to service_role;
