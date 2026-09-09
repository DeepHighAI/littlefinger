-- 운영자가 추천만 바꾸며 이미 저장된 약속의 본문에는 손대지 않는다.
insert into public.app_configs (key, value)
values ('promise_featured_presets', '{
  "reward": {
    "ko": ["다음 메뉴 선택권", "주말 계획 결정권", "칭찬 세 가지"],
    "en": ["Pick the next menu", "Decide the weekend plan", "Three compliments"]
  },
  "penalty": {
    "ko": ["설거지 1주일", "소원권 1장 주기", "노래방 한 곡"],
    "en": ["Dishes for a week", "Give one wish coupon", "Sing one karaoke song"]
  }
}'::jsonb)
on conflict (key) do nothing;

-- app_configs는 이미 공개 읽기·운영자 전용 쓰기로 보호되는 설정 테이블이다.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_configs'
    ) then
    alter publication supabase_realtime add table public.app_configs;
  end if;
end;
$$;
