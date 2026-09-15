-- 약속 보관 만료 시 거절 기록을 전체 검색하지 않고 함께 정리한다.
create index invitation_declines_promise_id_idx on public.invitation_declines(promise_id);
