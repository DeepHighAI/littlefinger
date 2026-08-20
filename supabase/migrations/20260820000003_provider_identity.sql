-- Google SSO 도입(PO 2026-08-20, 02 §6-2 개정 승인)에 따른 계정 정체성 키 일반화.
--
-- kakao_id 는 계정 정체성 키(EC-A05)이자 탈퇴 비식별화(§6-5)의 입력인데, 이름과
-- lf_user_provision 의 provider='kakao' 고정 때문에 Google 사용자는 외부 식별자가 영원히
-- 'pending:'으로 남아 탈퇴 해시·재가입 비승계가 무의미해진다. 컬럼을 provider_user_id 로
-- 개명하고 provider 컬럼을 더해 두 프로바이더를 같은 규칙으로 다룬다.

-- 1) 컬럼 개명 + provider. 유니크는 프로바이더별 회원번호 공간이 독립이라 복합으로 바꾼다.
--    pending:/withdrawn: 센티널은 PK·해시 기반이라 자체적으로 유일하다.
alter table public.users rename column kakao_id to provider_user_id;
comment on column public.users.provider_user_id is
  'SSO 제공자 회원 식별자(EC-A05). 미확정이면 pending:<uuid>, 탈퇴 시 withdrawn:<sha256>.';

alter table public.users add column provider text
  constraint users_provider_check check (provider in ('kakao', 'google'));
comment on column public.users.provider is
  '식별자를 발급한 SSO 제공자. pending 단계에서는 NULL.';

-- 백필: 이 시점까지의 실값·탈퇴 해시는 전부 카카오 시절 계정이다. pending 만 미상으로 남긴다.
update public.users set provider = 'kakao' where provider_user_id not like 'pending:%';

alter table public.users drop constraint users_kakao_id_key;
alter table public.users add constraint users_provider_identity_key
  unique (provider, provider_user_id);

-- 2) lf_user_stub — 본문은 20260816000003 원문에서 컬럼명만 바뀐다. provider 는 로그인
--    프로바이더가 확정되는 provision 시점에 채운다.
create or replace function public.lf_user_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, provider_user_id, nickname, primary_surface)
  values (new.id, 'pending:' || new.id::text, '사용자', null)
  on conflict (id) do nothing;

  insert into public.terms_agreements (user_id, terms_version, privacy_version)
  values (
    new.id,
    public.lf_current_terms_version(),
    public.lf_current_privacy_version()
  )
  on conflict (user_id, terms_version, privacy_version) do nothing;

  return new;
end;
$$;

comment on function public.lf_user_stub is
  'auth.users INSERT와 같은 트랜잭션에서 public 사용자와 현재 약관 동의를 만든다.';

-- 3) lf_user_provision — 카카오·구글 중 가장 최근 로그인한 신원 하나를 쓴다.
--    pending 인 동안만 확정하고, 한번 확정된 정체성은 다른 프로바이더 로그인으로도 덮지
--    않는다(EC-A05: 계정 정체성은 최초 확정 신원 기준).
create or replace function public.lf_user_provision(
  p_user_id uuid,
  p_surface public.surface,
  p_nickname text default null,
  p_profile_image_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_provider_user_id text;
  v_nickname text;
  v_profile_image_url text;
begin
  select i.provider, i.provider_id into v_provider, v_provider_user_id
  from auth.identities i
  where i.user_id = p_user_id and i.provider in ('kakao', 'google')
  order by i.last_sign_in_at desc nulls last
  limit 1;

  -- 사용자 수정 메타데이터가 프로필 보정 전체를 실패시키지 않게 컬럼 한도에 맞춘다.
  v_nickname := left(nullif(btrim(p_nickname), ''), 40);
  v_profile_image_url := nullif(btrim(p_profile_image_url), '');

  insert into public.users as u (id, provider_user_id, provider, nickname, profile_image_url, primary_surface)
  values (
    p_user_id,
    coalesce(v_provider_user_id, 'pending:' || p_user_id::text),
    case when v_provider_user_id is not null then v_provider end,
    coalesce(v_nickname, '사용자'),
    v_profile_image_url,
    p_surface
  )
  on conflict (id) do update set
    provider_user_id = case
      when v_provider_user_id is not null and u.provider_user_id like 'pending:%'
        then v_provider_user_id
      else u.provider_user_id
    end,
    provider = case
      when v_provider_user_id is not null and u.provider_user_id like 'pending:%'
        then v_provider
      else u.provider
    end,
    nickname = coalesce(v_nickname, u.nickname),
    profile_image_url = coalesce(v_profile_image_url, u.profile_image_url),
    primary_surface = coalesce(u.primary_surface, p_surface),
    updated_at = now()
  where u.status = 'ACTIVE';

  -- 과거 동의가 하나라도 있으면 새 버전 동의를 추론하지 않는다.
  if not exists (
    select 1 from public.terms_agreements where user_id = p_user_id
  ) then
    insert into public.terms_agreements (user_id, terms_version, privacy_version)
    values (
      p_user_id,
      public.lf_current_terms_version(),
      public.lf_current_privacy_version()
    )
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;
end;
$$;

comment on function public.lf_user_provision is
  '로그인 뒤 프로필을 보정하고 동의 이력이 없는 기존 사용자에게 현재 약관 동의를 기록한다.';

-- 4) lf_account_withdraw — 파라미터명이 바뀌므로 create or replace 가 불가능해 drop 후
--    재생성한다. 본문은 20260818000001 원문에서 컬럼·파라미터명만 바뀐다. 탈퇴해도
--    provider 는 남는다: 같은 프로바이더 계정의 재가입 비승계 감지(EC-A07)에 쓰인다.
drop function public.lf_account_withdraw(uuid, uuid, text);

create function public.lf_account_withdraw(
  p_idempotency_key uuid,
  p_actor uuid,
  p_anonymized_provider_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.user_status;
  v_affected uuid[];
  v_cached jsonb;
  v_response jsonb;
begin
  if p_anonymized_provider_user_id !~ '^withdrawn:[0-9a-f]{64}$' then
    raise exception 'E_VALIDATION';
  end if;

  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'account-withdraw');
  if v_cached is not null then return v_cached; end if;

  select u.status into v_status
  from public.users u
  where u.id = p_actor
  for update;

  if not found then raise exception 'E_AUTH_REQUIRED'; end if;
  if v_status = 'WITHDRAWN' then
    v_response := jsonb_build_object('status', 'WITHDRAWN');
    perform public.lf_idempotency_finish(p_idempotency_key, v_response);
    return v_response;
  end if;
  if v_status <> 'ACTIVE' then raise exception 'E_FORBIDDEN'; end if;

  -- 확정 전 개인 초안만 삭제한다. 확정 뒤 기록은 어느 경로에서도 지우지 않는다.
  delete from public.promises p
  where p.creator_id = p_actor and p.status = 'DRAFT';

  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into v_affected
  from public.promises p
  where p.status = 'PENDING'
    and (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants pp
        where pp.promise_id = p.id and pp.user_id = p_actor
          and pp.status in ('INVITED', 'JOINED')
      )
    );

  update public.invitations i
     set status = 'REVOKED'
   where i.promise_id = any(v_affected) and i.status = 'PENDING';
  update public.reminder_schedules rs
     set status = 'CANCELED'
   where rs.promise_id = any(v_affected) and rs.status = 'PENDING';
  update public.promises p
     set status = 'DECLINED', closed_at = now(), updated_at = now(),
         lock_version = p.lock_version + 1
   where p.id = any(v_affected) and p.status = 'PENDING';

  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into v_affected
  from public.promises p
  where p.status = 'AMEND_PENDING'
    and (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants pp
        where pp.promise_id = p.id and pp.user_id = p_actor and pp.status = 'JOINED'
      )
    );

  update public.amend_requests ar
     set status = 'WITHDRAWN', responded_by = p_actor, responded_at = now()
   where ar.promise_id = any(v_affected) and ar.status = 'PENDING';
  update public.reminder_schedules rs
     set status = 'CANCELED'
   where rs.promise_id = any(v_affected) and rs.status = 'PENDING'
     and rs.kind = 'AMEND_REMIND';
  update public.promises p
     set status = 'ACTIVE', updated_at = now(), lock_version = p.lock_version + 1
   where p.id = any(v_affected) and p.status = 'AMEND_PENDING';

  delete from public.device_tokens where user_id = p_actor;
  delete from public.blocks where blocker_id = p_actor or blocked_user_id = p_actor;

  update public.users
     set provider_user_id = p_anonymized_provider_user_id,
         nickname = '탈퇴한 사용자',
         profile_image_url = null,
         email = null,
         email_verified = false,
         email_bounce_count = 0,
         notification_pref = '{}'::jsonb,
         status = 'WITHDRAWN',
         withdrawn_at = now(),
         updated_at = now()
   where id = p_actor;

  v_response := jsonb_build_object('status', 'WITHDRAWN');
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

-- 5) create or replace / drop-create 뒤 서버 전용 3중 revoke 기준선을 다시 못박는다.
revoke all on function public.lf_user_provision(uuid, public.surface, text, text)
  from public, anon, authenticated;
revoke all on function public.lf_account_withdraw(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.lf_user_provision(uuid, public.surface, text, text)
  to service_role;
grant execute on function public.lf_account_withdraw(uuid, uuid, text) to service_role;
