-- Expo 푸시 토큰 등록 — 02 §4-1-3.5 · EC-H04.
--
-- 앱은 Expo Push Service 토큰을 쓰지만 초기 스키마의 컬럼명은 `fcm_token` 으로 이미
-- 확정돼 있다. 이름을 바꾸면 기존 마이그레이션·알림 경로 전체가 흔들리므로 이 컬럼에
-- Expo 토큰을 저장한다. FCM 은 Expo Push Service 내부 전달 계층이다.

create or replace function public.lf_device_token_register(
  p_user_id uuid,
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lf_assert_actor(p_user_id);

  if nullif(btrim(p_expo_push_token), '') is null then
    raise exception 'E_VALIDATION';
  end if;

  -- 한 기기에서 계정을 바꾸면 같은 Expo 토큰이 새 계정으로 이동한다. UNIQUE 충돌을
  -- 실패로 남기면 새 계정은 알림을 영원히 못 받는다.
  insert into public.device_tokens as t (user_id, fcm_token, platform)
  values (p_user_id, btrim(p_expo_push_token), 'ANDROID')
  on conflict (fcm_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    last_seen_at = now();

  -- EC-H04: 사용자별 최신 세 기기만 보관한다. 같은 시각이면 id 로 순서를 고정해
  -- 두 실행이 서로 다른 행을 남기지 않게 한다.
  delete from public.device_tokens
   where id in (
     select id
       from public.device_tokens
      where user_id = p_user_id
      order by last_seen_at desc, id desc
      offset 3
   );
end;
$$;

comment on function public.lf_device_token_register(uuid, text) is
  '앱 로그인 뒤 Expo 푸시 토큰을 등록하고 사용자별 최신 3개만 유지한다(EC-H04).';

revoke all on function public.lf_device_token_register(uuid, text)
  from public, anon, authenticated;

grant execute on function public.lf_device_token_register(uuid, text)
  to service_role;
