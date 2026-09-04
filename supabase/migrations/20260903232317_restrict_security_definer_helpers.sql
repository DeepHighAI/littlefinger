-- RLS 보조 함수는 호출 권한이 필요하지만 Data API RPC로 노출될 이유는 없다.
-- 비노출 스키마로 옮겨 정책과 트리거 내부에서만 실행되도록 한다.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

alter function public.can_read_promise(uuid) set schema private;
alter function public.is_promise_participant(uuid) set schema private;
alter function public.lf_is_active_actor() set schema private;
alter function public.lf_user_stub() set schema private;

revoke all on function private.can_read_promise(uuid) from public, anon, authenticated;
revoke all on function private.is_promise_participant(uuid) from public, anon, authenticated;
revoke all on function private.lf_is_active_actor() from public, anon, authenticated;
revoke all on function private.lf_user_stub() from public, anon, authenticated;

-- 익명 조회도 정보 노출 없이 빈 결과가 되어야 하므로 RLS 판정 함수 실행은 유지한다.
grant execute on function private.can_read_promise(uuid) to anon, authenticated, service_role;
grant execute on function private.is_promise_participant(uuid) to anon, authenticated, service_role;
grant execute on function private.lf_is_active_actor() to anon, authenticated, service_role;

-- 운영 Supabase에는 auth 역할이 있지만 PGlite 기반 스키마 검증에는 없다.
-- 역할이 있는 환경에서만 트리거 보조 함수의 명시적 권한을 복원한다.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema private to supabase_auth_admin';
    execute 'grant execute on function private.lf_user_stub() to supabase_auth_admin';
  end if;
end
$$;
