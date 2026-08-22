-- 약관·개인정보 처리방침 확정판 (2026-08-22.1, PO 2026-08-22).
-- 실제 사업자 정보(주식회사 딥하이)가 들어간 첫 배포판 — 신규 가입의 동의 기록이 이 버전으로 남는다.
-- 기존 사용자에게 새 버전 동의를 소급 추론하지 않는 규칙(lf_user_provision)은 그대로다.
-- create or replace 는 기존 ACL(3중 revoke + service_role grant)을 유지하므로 재선언하지 않는다.
-- 정본 대조: packages/shared/src/legal.ts 의 LEGAL_DOCUMENTS 와
-- supabase/tests/user-provisioning.test.ts 가 드리프트를 잡는다.

create or replace function public.lf_current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.1'::text $$;

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.1'::text $$;
