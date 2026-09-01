-- 카카오 OAuth 는 HTTPS 로 접근 가능한 CDN 이미지를 간혹 HTTP URL 로 반환한다.
-- 응답 파서는 프로필 이미지를 HTTPS 로만 받으므로 저장 경계에서 승격하고 기존 행도 보정한다.

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
  if v_profile_image_url ~* '^http://k[.]kakaocdn[.]net/' then
    v_profile_image_url := regexp_replace(
      v_profile_image_url,
      '^http://k[.]kakaocdn[.]net/',
      'https://k.kakaocdn.net/',
      'i'
    );
  end if;
  if v_profile_image_url is not null and v_profile_image_url !~*
    '^https://[^/?#[:space:]]+([/?#][^[:space:]]*)?$'
  then
    raise exception 'E_VALIDATION';
  end if;

  insert into public.users as u (
    id,
    provider_user_id,
    provider,
    nickname,
    profile_image_url,
    primary_surface
  )
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
  '로그인 뒤 프로필을 보정하고 프로필 이미지 URL을 HTTPS로 정규화한다.';

revoke all on function public.lf_user_provision(uuid, public.surface, text, text)
  from public, anon, authenticated;
grant execute on function public.lf_user_provision(uuid, public.surface, text, text)
  to service_role;

update public.users
set profile_image_url = regexp_replace(
      profile_image_url,
      '^http://k[.]kakaocdn[.]net/',
      'https://k.kakaocdn.net/',
      'i'
    ),
    updated_at = now()
where profile_image_url ~* '^http://k[.]kakaocdn[.]net/';

alter table public.users
  add constraint users_profile_image_url_https
  check (
    profile_image_url is null
    or profile_image_url ~* '^https://[^/?#[:space:]]+([/?#][^[:space:]]*)?$'
  );
