-- 사용자 프로비저닝 — 02_세부기능명세서 §165 (로그인 시 users 조회 → 없으면 생성).
--
-- 이 마이그레이션이 존재하는 이유는 버그 하나다: `public.users` 에 행을 만드는 코드가
-- 프로덕션에 없었다. auth.users 트리거도 없고 INSERT 정책도 없고, 저장소에서
-- `insert into public.users` 를 하는 곳은 PGlite 하니스 한 곳뿐이었다. 그래서
-- `lf_assert_actor` 가 로그인한 모든 사용자를 `E_AUTH_REQUIRED` 로 거부했다.
-- 인증은 멀쩡한데 인증 오류가 나오므로 같은 증상으로 진단이 두 번 틀렸고, 987개
-- 테스트가 통과한 이유도 같다 — 하니스는 프로덕션이 만들지 않는 행을 만들어 준다.
--
-- 해법은 두 겹이다(PO 2026-07-30): 트리거가 **행의 존재를 보장**하고, 로그인 뒤 호출이
-- **아는 값으로 보정**한다. 한 겹으로 안 되는 이유가 각 절에 적혀 있다.

-- ============================================================
-- primary_surface 를 nullable 로 — 02 §6-2 의 NOT NULL 에서 의도적으로 벗어난다
-- ============================================================
--
-- §165 는 `primary_surface` = 로그인 표면이라고 정하는데, 트리거는 그것을 알 수 없다.
-- auth.users 의 INSERT 만 봐서는 앱에서 온 것과 수락 웹에서 온 것이 구분되지 않는다.
-- enum 은 ('APP','WEB') 둘뿐이라 "아직 모름"을 담을 값이 없고, 한쪽으로 지어내면
-- 상대방이 처음 들어오는 곳이 수락 웹이므로 WEB 가입자 다수가 APP 으로 기록된다 —
-- 이 컬럼이 존재하는 유일한 목적(앱 설치 전환 KPI, §6-2)이 그 순간 사라진다.
--
-- 그래서 NULL 이 "아직 모름"이고, 보정은 **먼저 쓴 값만** 채운다(= 최초 가입 표면).
alter table public.users alter column primary_surface drop not null;

comment on column public.users.primary_surface is
  '최초 가입 표면(§6-2). NULL 은 아직 보정되지 않은 상태다 — 트리거는 이 값을 알 수 없다.';

-- ============================================================
-- 트리거 — 행의 존재를 보장한다. **절대 raise 하지 않는다.**
-- ============================================================
--
-- `after insert on auth.users` 가 실패하면 그 INSERT 가 롤백된다. 즉 프로비저닝 실패가
-- 그대로 **로그인 실패**가 된다. `kakao_id` 와 `nickname` 이 NOT NULL 이고 카카오
-- `profile_nickname` 은 [선택 동의](§6-1)이므로, 닉네임을 거부한 사용자가 로그인 자체를
-- 못 하게 되는 경로가 실재한다. 그래서 예외를 삼킨다 — 보통은 틀린 선택이지만 여기서
-- 대안은 전면 로그인 장애다.
--
-- 그리고 이 트리거는 auth 쪽 값을 **읽지 않는다.** gotrue 는 `raw_user_meta_data` 를
-- 별도 UPDATE 로 쓰고 `auth.identities` 행은 users 행 **다음에** 만든다. 이 시점에는
-- 둘 다 없다. 대진값만 넣고 실값은 보정이 채운다.
create or replace function public.lf_user_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 'pending:' || id 는 구성상 유일하다. kakao_id 의 unique 제약이 여기서 터질 일이 없다.
  insert into public.users (id, kakao_id, nickname, primary_surface)
  values (new.id, 'pending:' || new.id::text, '사용자', null)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    return new;
end;
$$;

comment on function public.lf_user_stub is
  'auth.users INSERT 시 public.users 대진 행을 만든다. 실패해도 로그인을 막지 않는다.';

-- 다른 `lf_*` 처럼 revoke 하지 **않는다.** 트리거 실행이 EXECUTE 권한을 재확인하는지
-- 확실하지 않은데, 만약 확인한다면 revoke 한 순간 모든 로그인이 죽는다. 대신 이 함수는
-- 애초에 호출 표면이 없다 — 트리거 함수를 직접 부르면 Postgres 가 거부하고,
-- 반환형이 `trigger` 라 PostgREST 도 노출하지 않는다.
drop trigger if exists lf_user_stub_on_auth_insert on auth.users;
create trigger lf_user_stub_on_auth_insert
  after insert on auth.users
  for each row execute function public.lf_user_stub();

-- ============================================================
-- 백필 — 트리거가 생기기 전에 로그인한 계정
-- ============================================================
--
-- 트리거는 앞으로의 INSERT 만 잡는다. 카카오 검증 때 이미 만들어진 계정은 이 백필이
-- 없으면 계속 막힌 상태로 남는다. 여기서는 auth 쪽 값이 이미 다 있으므로 읽어서 채운다.
-- `primary_surface` 는 지난 로그인의 표면을 알 방법이 없으므로 NULL 로 두고, 다음 로그인의
-- 보정 호출이 채운다.
with kakao as (
  select distinct on (user_id)
    user_id,
    provider_id,
    identity_data
  from auth.identities
  where provider = 'kakao'
  order by user_id, last_sign_in_at desc nulls last
)
insert into public.users (id, kakao_id, nickname, profile_image_url, primary_surface)
select
  u.id,
  coalesce(k.provider_id, 'pending:' || u.id::text),
  coalesce(nullif(btrim(k.identity_data->>'name'), ''), '사용자'),
  nullif(btrim(k.identity_data->>'avatar_url'), ''),
  null
from auth.users u
left join kakao k on k.user_id = u.id
on conflict (id) do nothing;

-- ============================================================
-- lf_user_provision — 로그인 뒤 보정 (§165)
-- ============================================================
--
-- `kakao_id` 를 **인자로 받지 않는다.** `auth.identities.provider_id` 에서 직접 읽는다.
-- gotrue 의 kakao.go 는 Subject 와 ProviderId 를 모두 카카오 회원번호로 채우고,
-- external.go 가 그 맵을 `identities.identity_data` 와 `users.raw_user_meta_data` **양쪽**에
-- 쓴다. 뒤쪽은 `user_metadata` 이고 `updateUser({data})` 로 사용자가 덮어쓸 수 있다 —
-- 거기서 읽으면 남의 회원번호를 주장할 수 있고, EC-A05 가 계정 동일성 판정에 쓰는 값이
-- 바로 이것이다. 클라이언트가 넘긴 값도 같은 이유로 받지 않는다(CLAUDE.md §5-6).
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
  v_kakao_id text;
  v_nickname text;
begin
  select i.provider_id into v_kakao_id
  from auth.identities i
  where i.user_id = p_user_id and i.provider = 'kakao'
  order by i.last_sign_in_at desc nulls last
  limit 1;

  -- 닉네임은 [선택 동의]다. claims 가 omitempty 라 거부하면 키가 **아예 없다** —
  -- 빈 문자열이 아니므로 '' 비교로는 잡히지 않는다.
  v_nickname := nullif(btrim(p_nickname), '');

  insert into public.users as u (id, kakao_id, nickname, profile_image_url, primary_surface)
  values (
    p_user_id,
    coalesce(v_kakao_id, 'pending:' || p_user_id::text),
    coalesce(v_nickname, '사용자'),
    p_profile_image_url,
    p_surface
  )
  on conflict (id) do update set
    -- 회원번호를 알아냈고 아직 대진값일 때만 채운다. 이미 실값이면 손대지 않는다 —
    -- kakao_id 는 계정 동일성의 기준이고(EC-A05), 탈퇴 계정에서는 해시로 대체돼
    -- 있어야 한다(§6-5).
    kakao_id = case
      when v_kakao_id is not null and u.kakao_id like 'pending:%' then v_kakao_id
      else u.kakao_id
    end,
    nickname = coalesce(v_nickname, u.nickname),
    profile_image_url = coalesce(p_profile_image_url, u.profile_image_url),
    -- 최초 가입 표면이다. 먼저 쓴 값이 이긴다.
    primary_surface = coalesce(u.primary_surface, p_surface),
    updated_at = now()
  -- ACTIVE 가 아닌 계정은 통째로 손대지 않는다. 탈퇴 계정을 보정하면 §6-5 의
  -- 비식별화(nickname → '탈퇴한 사용자', profile_image_url → NULL)를 되돌리게 된다.
  where u.status = 'ACTIVE';
end;
$$;

comment on function public.lf_user_provision is
  '로그인 뒤 users 행 보정 (02 §165). kakao_id 는 auth.identities 에서 직접 읽는다.';

-- ============================================================
-- 서버 전용 — 3중 revoke
-- ============================================================
-- `from public` 만으로는 부족하다. Supabase 는 public 스키마 함수에 anon·authenticated
-- 실행 권한을 기본으로 주므로, 세 역할을 모두 적어야 anon 키로 직접 부를 수 없게 된다.
revoke all on function public.lf_user_provision(uuid, public.surface, text, text)
  from public, anon, authenticated;

grant execute on function public.lf_user_provision(uuid, public.surface, text, text)
  to service_role;
