-- 이용약관·개인정보 처리방침 2026-08-30.1 — ADR 0015 반영 (PO 2026-08-30).
-- 약관: 유료 상품 2종(약속 슬롯 추가·영구 보관)과 결제·청약철회·환불(제13조), 참여자별 열람권과
-- 삭제 규칙(제14조), 보상형 광고(제12조 ③~⑤), 종료일 없는 약속(제9조 ④⑤), 통신판매업 신고번호.
-- 방침: 구매 정보·보상형 광고 처리 정보 수집 항목, 보유 기간(증빙 365일 규칙 폐기 → 기록과 함께),
-- Google Play·AdMob SSV 위탁·국외 이전, 노출형/보상형 광고 구분.
-- 두 문서 모두 텍스트가 바뀌었으므로 두 함수를 함께 올린다. 즉시 시행이며 외부 법무 검토는
-- 병행한다 — 검토 결과는 2026-08-30.2 로 올린다. 기존 동의는 소급 추론하지 않는다(20260816000003).
-- create or replace 는 기존 ACL(3중 revoke + service_role grant)을 유지한다.

create or replace function public.lf_current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-30.1'::text $$;

create or replace function public.lf_current_privacy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-08-30.1'::text $$;
