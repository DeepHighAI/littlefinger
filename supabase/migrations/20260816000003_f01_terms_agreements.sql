-- F-01 약관 동의 기록 — 현재 버전은 서버만 결정하고 클라이언트는 읽기만 한다.

create or replace function public.lf_current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-16-draft.1'::text $$;

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-16-draft.1'::text $$;

create unique index terms_agreements_version_unique
  on public.terms_agreements (user_id, terms_version, privacy_version);

drop policy if exists "terms insert own" on public.terms_agreements;
revoke insert on public.terms_agreements from anon, authenticated;
revoke update, delete on public.terms_agreements from anon, authenticated;

-- 신규 사용자는 auth.users, public.users, 약관 동의가 한 문장으로 성공하거나 모두 롤백된다.
create or replace function public.lf_user_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, kakao_id, nickname, primary_surface)
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

  -- 사용자 수정 메타데이터가 프로필 보정 전체를 실패시키지 않게 컬럼 한도에 맞춘다.
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

revoke all on function public.lf_current_terms_version()
  from public, anon, authenticated;
revoke all on function public.lf_current_privacy_version()
  from public, anon, authenticated;
revoke all on function public.lf_user_provision(uuid, public.surface, text, text)
  from public, anon, authenticated;

grant execute on function public.lf_current_terms_version(), public.lf_current_privacy_version()
  to service_role;
grant execute on function public.lf_user_provision(uuid, public.surface, text, text)
  to service_role;
