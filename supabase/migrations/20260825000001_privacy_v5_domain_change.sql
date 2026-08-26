-- 개인정보 처리방침 2026-08-25.1 — 서비스 도메인 변경 반영.
-- 8항의 계정 삭제 안내 페이지 URL 이 littlefinger-app-philwoo.web.app 에서
-- littlefinger-app.web.app 로 바뀌었다(PO 2026-08-25: 서비스명에서 개인 이름 제거, ADR 0010).
-- 약관은 텍스트가 그대로라 lf_current_terms_version() 은 2026-08-22.3 에 머문다 —
-- 두 문서의 버전은 독립이고, 텍스트가 바뀐 문서만 올린다.
-- create or replace 는 기존 ACL(3중 revoke + service_role grant)을 유지한다.

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-25.1'::text $$;
