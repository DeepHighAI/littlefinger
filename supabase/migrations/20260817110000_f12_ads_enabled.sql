-- F-12 원격 광고 플래그의 안전한 초기값.
-- 운영자가 이미 결정한 값을 재배포가 덮어쓰면 안 되므로 INSERT 전용이다.

insert into public.app_configs (key, value)
values ('ads_enabled', 'false'::jsonb)
on conflict (key) do nothing;
