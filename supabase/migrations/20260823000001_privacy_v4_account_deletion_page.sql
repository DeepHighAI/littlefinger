-- 개인정보 처리방침 2026-08-23.1 — 계정 삭제 안내 페이지(/account-deletion)를 8항에 명시.
-- (Google Play 데이터 보안 양식이 요구하는 웹 삭제 경로 신설에 따른 개정.)
-- 약관은 텍스트가 그대로라 lf_current_terms_version() 은 2026-08-22.3 에 머문다 —
-- 두 문서의 버전은 독립이고, 텍스트가 바뀐 문서만 올린다.
-- create or replace 는 기존 ACL(3중 revoke + service_role grant)을 유지한다.

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-23.1'::text $$;
