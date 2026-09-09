-- 직접 설정한 별명은 다음 OAuth 로그인으로 덮어쓰지 않는다.
alter table public.users add column nickname_is_custom boolean not null default false;

-- 기존 별명이 제공자 값과 다르면 사용자가 설정한 값으로 보수적으로 보존한다.
update public.users u set nickname_is_custom = true
where u.status = 'ACTIVE' and u.nickname <> '사용자' and position('@' in u.nickname) = 0
  and not exists (
    select 1 from auth.users a
    where a.id = u.id and u.nickname in (
      a.raw_user_meta_data->>'nickname', a.raw_user_meta_data->>'name',
      a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'preferred_username'
    )
  );

-- 이메일 형태로 저장된 공개 이름을 제공자의 안전한 이름 또는 대체값으로 보정한다.
update public.users u
set nickname = coalesce((
  select left(public.lf_normalize_input(candidate.value), 40)
  from auth.users a,
    lateral (values (1, a.raw_user_meta_data->>'nickname'), (2, a.raw_user_meta_data->>'name'),
      (3, a.raw_user_meta_data->>'full_name'), (4, a.raw_user_meta_data->>'preferred_username')) candidate(priority, value)
  where a.id = u.id and nullif(btrim(candidate.value), '') is not null
    and position('@' in candidate.value) = 0
  order by candidate.priority limit 1
), '사용자'), updated_at = now()
where u.status = 'ACTIVE' and position('@' in u.nickname) > 0;

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
  v_nickname := nullif(public.lf_normalize_input(p_nickname), '');
  if position('@' in v_nickname) > 0 then v_nickname := null; end if;
  v_nickname := left(v_nickname, 40);
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
    nickname = case when u.nickname_is_custom then u.nickname else coalesce(v_nickname, u.nickname) end,
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

create or replace function public.lf_profile_nickname_update(
  p_idempotency_key uuid,
  p_actor uuid,
  p_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := public.lf_normalize_input(p_nickname);
  v_cached jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'profile-nickname-update');
  if v_cached is not null then return v_cached; end if;
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 40 or position('@' in v_nickname) > 0 then
    raise exception 'E_VALIDATION';
  end if;
  update public.users
     set nickname = v_nickname, nickname_is_custom = true, updated_at = now()
   where id = p_actor;
  v_response := jsonb_build_object('nickname', v_nickname);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_user_provision(uuid, public.surface, text, text) from public, anon, authenticated;
grant execute on function public.lf_user_provision(uuid, public.surface, text, text) to service_role;
revoke all on function public.lf_profile_nickname_update(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.lf_profile_nickname_update(uuid, uuid, text) to service_role;
