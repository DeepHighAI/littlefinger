-- 신원을 추정하지 않고 토큰 소지자의 명시적 거절을 별도 원장에 남긴다.
-- server-only: invitation_declines
create table public.invitation_declines (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  promise_id uuid not null references public.promises(id) on delete cascade,
  target_role public.participant_role not null,
  content_hash char(64),
  ip_hash char(64),
  user_agent_hash char(64),
  declined_at timestamptz not null default now()
);
alter table public.invitation_declines enable row level security;
revoke all on public.invitation_declines from public, anon, authenticated;
grant select, insert, delete on public.invitation_declines to service_role;

create function public.lf_invite_decline_public(p_token_hash char(64), p_ip_hash char(64), p_ua_hash char(64))
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
  v_p public.promises%rowtype;
  v_hash char(64);
begin
  -- 승인·참여·발송 전 삭제와 같은 초대→약속 잠금 순서를 사용한다.
  select * into v_inv from public.invitations where token_hash = p_token_hash for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if exists (select 1 from public.invitation_declines where invitation_id = v_inv.id) then
    return jsonb_build_object('target_role', v_inv.target_role, 'status', 'DECLINED');
  end if;
  perform public.lf_invite_resolve(p_token_hash);
  select * into strict v_p from public.promises where id = v_inv.promise_id for update;
  if v_inv.target_role = 'PARTNER' then
    if v_p.status <> 'PENDING' then raise exception 'E_STATE_CONFLICT'; end if;
    select public.lf_content_hash(title, body, category, end_date, keeper, reward, penalty, version_no)
      into strict v_hash from public.promise_versions where promise_id = v_p.id and activated_at is null;
    update public.promises set status = 'DECLINED', closed_at = now(),
      lock_version = lock_version + 1, updated_at = now() where id = v_p.id;
    update public.promise_participants set status = 'DECLINED'
      where promise_id = v_p.id and role = 'PARTNER';
    if not found then
      insert into public.promise_participants(promise_id, role, status) values(v_p.id, 'PARTNER', 'DECLINED');
    end if;
    update public.reminder_schedules set status = 'CANCELED' where promise_id = v_p.id and status = 'PENDING';
  elsif v_inv.target_role = 'WITNESS' then
    update public.promise_participants set status = 'DECLINED'
      where invitation_id = v_inv.id and role = 'WITNESS' and status = 'INVITED' and user_id is null;
    if not found then raise exception 'E_INVITE_USED'; end if;
  else
    raise exception 'E_FORBIDDEN';
  end if;
  update public.invitations set status = 'USED', used_at = now(), used_by = null where id = v_inv.id;
  insert into public.invitation_declines(invitation_id, promise_id, target_role, content_hash, ip_hash, user_agent_hash)
    values(v_inv.id, v_p.id, v_inv.target_role, v_hash, p_ip_hash, p_ua_hash);
  perform public.lf_notification_outbox_enqueue(v_inv.created_by, v_p.id, 'NT-02',
    jsonb_build_object('promiseTitle', v_p.title, 'partnerNickname',
      case when v_inv.target_role = 'WITNESS' then '증인 초대 수신자' else '초대 링크 수신자' end),
    'invitation-decline:' || v_inv.id::text, now());
  return jsonb_build_object('target_role', v_inv.target_role, 'status', 'DECLINED');
end;
$$;
revoke all on function public.lf_invite_decline_public(char(64), char(64), char(64)) from public, anon, authenticated;
grant execute on function public.lf_invite_decline_public(char(64), char(64), char(64)) to service_role;

create or replace function public.lf_witness_preview(
  p_actor uuid,
  p_token_hash char(64)
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p_promise_id uuid;
  v_inv public.invitations%rowtype;
  v_promise public.promises%rowtype;
  v_version public.promise_versions%rowtype;
  v_creator jsonb;
  v_partner jsonb;
  v_signed_at timestamptz;
  v_fulfillment jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  perform public.lf_invite_resolve(p_token_hash);
  select * into strict v_inv from public.invitations where token_hash = p_token_hash;
  if v_inv.target_role <> 'WITNESS' then raise exception 'E_FORBIDDEN'; end if;
  p_promise_id := v_inv.promise_id;
  if exists (select 1 from public.promise_participants where promise_id = p_promise_id and user_id = p_actor) then
    raise exception 'E_DUPLICATE_ROLE';
  end if;
  if not exists (select 1 from public.promise_participants where invitation_id = v_inv.id and role = 'WITNESS' and status = 'INVITED' and user_id is null) then
    raise exception 'E_INVITE_USED';
  end if;
  if exists (select 1 from public.blocks b join public.promise_participants pp
    on pp.promise_id = p_promise_id and pp.role in ('CREATOR', 'PARTNER') and pp.status = 'JOINED'
    where (b.blocker_id = p_actor and b.blocked_user_id = pp.user_id)
       or (b.blocked_user_id = p_actor and b.blocker_id = pp.user_id)) then raise exception 'E_BLOCKED'; end if;

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

revoke all on function public.lf_witness_preview(uuid, char(64)) from public, anon, authenticated;
grant execute on function public.lf_witness_preview(uuid, char(64)) to service_role;

create or replace function public.lf_invite_resolve(p_token_hash char(64))
returns jsonb
language plpgsql
set search_path = ''
-- stable 은 계획 최적화가 아니라 **강제 장치**다. 이 함수 안에서는 Postgres 가
-- INSERT/UPDATE/DELETE 자체를 거부한다 — 읽기 경로가 초대를 소모하거나(EC-A01)
-- J-04 의 만료 처리(T-06)를 대신 수행하는 사고를 문법 수준에서 막는다.
stable
as $$
declare
  v_status public.invitation_status;
  v_lapsed boolean;
  v_payload jsonb;
begin
  -- 작성자는 promises.creator_id 로 찾는다. invitations.created_by 가 아니다 —
  -- §4-5-2 에서 증인 초대는 상대방도 보낼 수 있어서, created_by 로 조인하면
  -- 그 경우에만 엉뚱한 사람 이름이 나간다.
  --
  -- 제목은 promises 의 현재 버전 캐시에서 읽는다(§6-2). promise_versions 로
  -- 조인하면 안 된다 — current_version_id 는 확정(ACTIVE) 전에는 비어 있어서,
  -- 정작 이 함수가 존재하는 이유인 PENDING 초대가 전부 E_NOT_FOUND 가 된다.
  select i.status,
         i.expires_at <= now(),
         jsonb_build_object(
           'creator_nickname', u.nickname,
           'sender_nickname', (select nickname from public.users where id = i.created_by),
           'title',            p.title,
           'expires_at',       i.expires_at,
           'target_role',      i.target_role
         )
    into v_status, v_lapsed, v_payload
    from public.invitations i
    join public.promises p on p.id = i.promise_id
    join public.users u on u.id = p.creator_id
   where i.token_hash = p_token_hash;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- 저장된 status 가 시계보다 **먼저**다. 사용된 토큰이 만료 시각을 넘겼다고
  -- E_INVITE_EXPIRED 로 바뀌면, 참여자 본인을 약속 상세로 보내는 EC-B02 분기가
  -- 구분할 근거를 잃는다.
  if v_status = 'REVOKED' then
    raise exception 'E_INVITE_REVOKED';
  end if;

  if v_status = 'USED' then
    raise exception 'E_INVITE_USED';
  end if;

  -- status='EXPIRED' 는 J-04 가 남긴 기록이고, v_lapsed 는 아직 J-04 가 오지 않은 구간이다.
  -- J-04 는 30분마다 돌기 때문에(§7-2) 둘 다 보지 않으면 만료된 링크가 최대 30분 더 열린다.
  if v_status = 'EXPIRED' or v_lapsed then
    raise exception 'E_INVITE_EXPIRED';
  end if;

  return v_payload;
end;
$$;
