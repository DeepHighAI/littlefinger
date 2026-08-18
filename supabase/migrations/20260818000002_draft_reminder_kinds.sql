-- J-06 초안 재개·삭제 예고 예약 종류. 새 enum 값은 다음 마이그레이션부터 사용한다.

alter type public.reminder_kind add value if not exists 'DRAFT_RESUME';
alter type public.reminder_kind add value if not exists 'DRAFT_DELETE_SOON';
