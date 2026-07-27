-- 요청 빈도 제한 — 02 §2-3 `E_RATE_LIMIT`.
--
-- §11-3 에 값이 없고 §10 의 `E_RATE_LIMIT` 용례는 전부 **자원 개수** 제한이다(초대 재발송 10회,
-- DRAFT 20건, 일 30건). 요청 빈도 제한은 명세 밖이라 PO 가 값을 정했다 —
-- **IP 당 10분 60회, invite-resolve 에만**(2026-07-27).
--
-- 이 함수가 따로 존재해야 하는 이유는 취향이 아니다. `lf_invite_resolve` 는 `stable` 이라
-- Postgres 가 그 안에서 INSERT/UPDATE 를 문법 수준에서 거부한다 — 읽기 경로가 초대를 소모하는
-- 사고를 막으려고 일부러 그렇게 뒀다. 카운터는 쓰기이므로 그 안에 넣을 수 없고, 넣으려면
-- `stable` 을 풀어야 하는데 그건 방금 말한 보호를 통째로 버리는 것이다.
--
-- 그래서 껍데기가 두 번 부른다: 먼저 이 함수, 통과하면 `lf_invite_resolve`.
-- 순서가 중요하다 — 실패한 조회도 카운트돼야 남용 방지가 의미를 갖는다.

-- ============================================================
-- 저장소
-- ============================================================

-- 고정 창(fixed window)이다. 슬라이딩 창은 요청마다 행이 필요한데, 막으려는 것이 대량 호출인
-- 상황에서 그 자체가 비용이 된다. 대가는 창 경계에서 최대 2배 버스트가 가능하다는 것이고,
-- 한도가 60 인 지금 그건 무해하다.
create table public.rate_limit_counters (
  -- `{endpoint}:{식별자}`. 식별자는 호출자에 따라 다르다 — invite-resolve 는 IP 해시다.
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

-- 만료 창 청소가 이 인덱스를 훑는다.
create index rate_limit_counters_window_idx on public.rate_limit_counters (window_start);

alter table public.rate_limit_counters enable row level security;

-- ============================================================
-- 정책을 만들지 않는다.
--
-- server-only: rate_limit_counters  클라이언트가 읽을 이유도, 쓸 이유도 없다.
--   쓸 수 있다면 남의 버킷을 미리 채워 그 사람을 차단할 수 있다.
-- ============================================================

-- ============================================================
-- 정책 값
-- ============================================================

-- `packages/shared/src/config.ts` 의 `INVITE_RESOLVE_RATE_LIMIT` 와 짝이다. SQL 은 그 파일을
-- 읽을 수 없으므로 `supabase/tests/rate-limit.test.ts` 가 두 값을 대조한다.
create or replace function public.lf_rate_limit_window_seconds()
returns int
language sql
immutable
as $$
  select 600;
$$;

create or replace function public.lf_rate_limit_max_hits()
returns int
language sql
immutable
as $$
  select 60;
$$;

-- ============================================================
-- 카운트 + 판정
-- ============================================================

create or replace function public.lf_rate_limit_hit(p_bucket text)
returns int
language plpgsql
as $$
declare
  v_window_seconds constant int := public.lf_rate_limit_window_seconds();
  v_window timestamptz;
  v_hits int;
begin
  -- 버킷 이름이 비면 전원이 한 버킷을 공유하게 된다. 그건 제한이 아니라 공용 차단 장치다.
  if p_bucket is null or btrim(p_bucket) = '' then
    raise exception 'E_VALIDATION';
  end if;

  -- 창 시작을 epoch 기준으로 내림한다. 호출자마다 창이 어긋나면 같은 버킷에 창이 무한히
  -- 생겨 한도가 사실상 사라진다.
  v_window := to_timestamp(floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds);

  -- 지난 창은 없던 것으로 친다. 별도 배치를 만들지 않는 이유는 `lf_idempotency_begin` 과 같다 —
  -- 청소를 자기 경로에 붙여 두면 잊힐 수 없다.
  delete from public.rate_limit_counters
   where window_start < v_window - make_interval(secs => v_window_seconds);

  -- 증가와 조회가 한 문장이다. 읽고 나서 쓰면 동시 요청 두 개가 같은 값을 읽어
  -- 한도를 넘긴 채로 둘 다 통과한다.
  insert into public.rate_limit_counters (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update
    set hits = public.rate_limit_counters.hits + 1
  returning hits into v_hits;

  if v_hits > public.lf_rate_limit_max_hits() then
    raise exception 'E_RATE_LIMIT';
  end if;

  return v_hits;
end;
$$;

comment on function public.lf_rate_limit_hit is
  '요청 빈도 제한 (02 §2-3 E_RATE_LIMIT). 고정 창 카운터. lf_invite_resolve 는 stable 이라 카운터를 품을 수 없어 분리했다.';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- `from public` 만으로는 닫히지 않는다 — Supabase 가 anon·authenticated 에게 직접 부여한다.
-- 여기서 한 줄이라도 빠지면 제한 장치 자체를 anon 이 호출해 남의 버킷을 채울 수 있다.
revoke all on function public.lf_rate_limit_window_seconds() from public, anon, authenticated;
revoke all on function public.lf_rate_limit_max_hits() from public, anon, authenticated;
revoke all on function public.lf_rate_limit_hit(text) from public, anon, authenticated;

grant execute on function public.lf_rate_limit_window_seconds() to service_role;
grant execute on function public.lf_rate_limit_max_hits() to service_role;
grant execute on function public.lf_rate_limit_hit(text) to service_role;
