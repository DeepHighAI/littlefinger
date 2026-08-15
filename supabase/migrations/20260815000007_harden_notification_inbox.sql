-- 알림 원본은 전송 ledger를 겸하므로 Data API에서 행 단위 공개하지 않는다.
-- 사용자 화면은 공개 필드만 반환하는 Edge Function과 service_role RPC를 거친다.

revoke select on table public.notifications from anon, authenticated;
