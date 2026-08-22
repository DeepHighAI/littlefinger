-- 약관·개인정보 처리방침 2026-08-22.2 — Codex 검증이 잡은 사실관계 수정 반영.
-- (웹 sessionStorage 임시 보관 고지 추가, 닉네임을 선택 수집 항목으로 재분류)
-- 문서 텍스트가 바뀌면 버전을 올린다는 개정 원칙에 따라 동의 버전도 함께 올린다.
-- create or replace 는 기존 ACL(3중 revoke + service_role grant)을 유지한다.

create or replace function public.lf_current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.2'::text $$;

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.2'::text $$;
