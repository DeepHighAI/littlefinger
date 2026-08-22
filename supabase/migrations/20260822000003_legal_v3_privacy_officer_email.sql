-- 약관·개인정보 처리방침 2026-08-22.3 — 개인정보 보호책임자 문의 이메일(task@deephigh.ai) 추가.
-- (외부 법무 검토 완료를 PO 가 확인한 판이기도 하다 — 텍스트 변경은 이메일 한 줄뿐이다.)
-- 문서 텍스트가 바뀌면 동의 버전을 함께 올린다. create or replace 는 기존 ACL 을 유지한다.

create or replace function public.lf_current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.3'::text $$;

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-22.3'::text $$;
