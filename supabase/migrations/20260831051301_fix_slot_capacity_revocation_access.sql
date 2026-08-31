-- Edge Function RPC는 service_role로 실행되지만 취소 구매 원장은 직접 읽지 못하게 잠겨 있다.
-- 20260827000001에서 원장을 추가하며 lf_slot_capacity의 실행 경계를 그대로 둬서, 슬롯 현황과
-- DRAFT → PENDING 전이가 원장을 읽는 순간 permission denied로 실패했다. 원장 SELECT를
-- service_role에 열지 않고 이 집계 함수 한 곳만 소유자 권한으로 읽게 한다.
alter function public.lf_slot_capacity(uuid) security definer;
alter function public.lf_slot_capacity(uuid) set search_path = '';

-- 공개 스키마의 SECURITY DEFINER 함수이므로 실행 주체를 다시 명시적으로 고정한다.
revoke all on function public.lf_slot_capacity(uuid) from public, anon, authenticated;
grant execute on function public.lf_slot_capacity(uuid) to service_role;
