-- 사용자 프로비저닝 보강 — 로그인 뒤 보정 경로만 users 를 쓸 수 있게 한다.
--
-- 20260730000011 은 행 생성과 실값 보정을 만들었지만 세 구멍이 남았다.
-- 1. users 의 자기 행 UPDATE 정책이 kakao_id·status 같은 서버 소유 컬럼까지 열었다.
-- 2. 빈 프로필 이미지 문자열이 이미 저장된 실값을 지웠다.
-- 3. user_metadata.name 은 사용자가 임의로 늘릴 수 있어 varchar(40) 초과 시 보정 전체가
--    롤백됐다. 그러면 안전한 auth.identities 의 kakao_id 도 대진값으로 남는다.

-- 클라이언트 쓰기 경로는 user-provision Edge Function 하나다. Postgres RLS 정책은 컬럼별
-- UPDATE 제한을 표현하지 못하므로 자기 행 전체를 열었던 정책을 제거한다.
drop policy if exists "users update own" on public.users;

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
  v_profile_image_url text;
begin
  select i.provider_id into v_kakao_id
  from auth.identities i
  where i.user_id = p_user_id and i.provider = 'kakao'
  order by i.last_sign_in_at desc nulls last
  limit 1;

  -- user_metadata 는 클라이언트가 바꿀 수 있다. DB 컬럼 한도를 넘긴 값 하나가
  -- kakao_id 보정까지 롤백하지 않도록 40 코드포인트에서 자른다.
  v_nickname := left(nullif(btrim(p_nickname), ''), 40);
  v_profile_image_url := nullif(btrim(p_profile_image_url), '');

  insert into public.users as u (id, kakao_id, nickname, profile_image_url, primary_surface)
  values (
    p_user_id,
    coalesce(v_kakao_id, 'pending:' || p_user_id::text),
    coalesce(v_nickname, '사용자'),
    v_profile_image_url,
    p_surface
  )
  on conflict (id) do update set
    kakao_id = case
      when v_kakao_id is not null and u.kakao_id like 'pending:%' then v_kakao_id
      else u.kakao_id
    end,
    nickname = coalesce(v_nickname, u.nickname),
    profile_image_url = coalesce(v_profile_image_url, u.profile_image_url),
    primary_surface = coalesce(u.primary_surface, p_surface),
    updated_at = now()
  where u.status = 'ACTIVE';
end;
$$;

comment on function public.lf_user_provision is
  '로그인 뒤 users 행 보정 (02 §165). 프로필 입력을 정제하고 서버 경로에서만 실행한다.';

-- create or replace 는 기존 권한을 보존하지만, 후속 마이그레이션만 따로 검토해도 서버
-- 전용 규칙이 보이도록 세 역할을 다시 명시한다.
revoke all on function public.lf_user_provision(uuid, public.surface, text, text)
  from public, anon, authenticated;

grant execute on function public.lf_user_provision(uuid, public.surface, text, text)
  to service_role;
