-- Idempotency-Key 저장소 — 02_세부기능명세서 §7-3.6 · EC-C01.
--
-- 상태 변경 요청은 전부 `Idempotency-Key`(UUID) 헤더를 달고 오고, 서버는 10분간 결과를
-- 캐시해 같은 키에 같은 응답을 돌려준다.
--
-- 핵심은 "같은 응답"이 아니라 **두 번째 요청이 아무 일도 하지 않는 것**이다. EC-C01 은
-- 수락 버튼을 연속으로 탭해도 `approvals` 행이 하나만 생겨야 한다고 못박는다. 그래서 캐시
-- 조회는 트랜잭션이 끝난 뒤가 아니라 **시작하기 전**에 끊는다.
--
-- 사용법 — B1-4 이후의 RPC 는 전부 이 모양이다.
--   v_cached := lf_idempotency_begin(key, user_id, 'promise-approve');
--   if v_cached is not null then return v_cached; end if;
--   … 실제 작업 …
--   perform lf_idempotency_finish(key, v_response);

-- ============================================================
-- 저장소
-- ============================================================

create table public.idempotency_keys (
  -- 클라이언트가 만든 UUID 를 그대로 기본키로 쓴다. 이 유일성 제약이 곧 중복 차단 장치다.
  key uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  -- 클레임 시점에는 비어 있고 작업이 끝나면 채워진다.
  response jsonb,
  created_at timestamptz not null default now()
);

-- 만료 판정과 만료 청소가 같은 컬럼을 훑는다.
create index idempotency_keys_created_idx on public.idempotency_keys (created_at);

alter table public.idempotency_keys enable row level security;

-- ============================================================
-- 정책을 만들지 않는다.
--
-- server-only: idempotency_keys  요청 캐시. 클라이언트가 읽을 이유도, 심을 이유도 없다.
--   미리 심을 수 있다면 남의 요청을 캐시로 선점해 영구히 막아버릴 수 있다.
-- ============================================================

-- ============================================================
-- 유효 시간
-- ============================================================

-- §7-3.6 의 10분. `packages/shared/src/config.ts` 의 `IDEMPOTENCY_TTL_MIN` 과 짝이고,
-- SQL 은 그 파일을 읽을 수 없으므로 테스트가 두 값을 대조한다.
create or replace function public.lf_idempotency_ttl_minutes()
returns int
language sql
immutable
as $$
  select 10;
$$;

-- ============================================================
-- 클레임 — 캐시가 있으면 응답, 없으면 null
-- ============================================================

create or replace function public.lf_idempotency_begin(
  p_key uuid,
  p_user_id uuid,
  p_endpoint text
)
returns jsonb
language plpgsql
as $$
declare
  v_inserted int;
  v_row public.idempotency_keys%rowtype;
begin
  -- 만료된 키는 없던 것으로 친다. 지우고 나면 아래 insert 가 새 요청으로 잡는다.
  delete from public.idempotency_keys
   where key = p_key
     and created_at <= now() - make_interval(mins => public.lf_idempotency_ttl_minutes());

  -- 클레임은 조회가 아니라 insert 로 잡는다. 기본키 충돌이 곧 직렬화 장치다 —
  -- 같은 키가 동시에 들어오면 두 번째는 첫 트랜잭션이 끝날 때까지 여기서 대기한다.
  -- 첫 트랜잭션이 커밋하면 아래에서 그 응답을 읽고, 롤백하면 이쪽이 클레임을 가져간다.
  insert into public.idempotency_keys (key, user_id, endpoint)
  values (p_key, p_user_id, p_endpoint)
  on conflict (key) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return null;
  end if;

  select * into v_row from public.idempotency_keys where key = p_key;

  -- 키 하나는 (사용자, 엔드포인트) 한 쌍에만 속한다. 어긋난 요청에 캐시를 돌려주면
  -- 남의 응답이 그대로 새거나 엉뚱한 엔드포인트의 결과가 나간다.
  -- 어느 쪽이든 클라이언트가 새 키로 다시 보내야 하므로 코드는 하나로 둔다.
  if v_row.user_id <> p_user_id or v_row.endpoint <> p_endpoint then
    raise exception 'E_FORBIDDEN';
  end if;

  return v_row.response;
end;
$$;

comment on function public.lf_idempotency_begin is
  '요청 캐시 조회 겸 클레임 (02 §7-3.6). null 이면 호출자가 작업을 진행하고, 아니면 그 응답을 그대로 반환한다.';

-- ============================================================
-- 완료 — 응답을 캐시에 남긴다
-- ============================================================

-- 작업과 **같은 트랜잭션**에서 부른다. 그래야 작업이 실패했을 때 클레임도 함께 롤백돼
-- 재시도가 정상 실행된다 — 실패한 요청이 10분간 캐시되는 일은 없다.
create or replace function public.lf_idempotency_finish(
  p_key uuid,
  p_response jsonb
)
returns void
language sql
as $$
  update public.idempotency_keys set response = p_response where key = p_key;
$$;

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- 함수는 기본으로 public 에 execute 가 열려 있다. 닫지 않으면 저장소를 서버 전용으로
-- 막아 둔 의미가 없다 — 클라이언트가 함수를 통해 캐시를 심을 수 있게 된다.
--
-- **`from public` 만으로는 닫히지 않는다.** Supabase 는 public 스키마에
-- `alter default privileges … grant all on functions to anon, authenticated` 를 걸어 두므로
-- anon·authenticated 는 PUBLIC 과 별개로 직접 부여받는다. 세 대상을 모두 회수해야 한다.
revoke all on function public.lf_idempotency_ttl_minutes() from public, anon, authenticated;
revoke all on function public.lf_idempotency_begin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.lf_idempotency_finish(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.lf_idempotency_ttl_minutes() to service_role;
grant execute on function public.lf_idempotency_begin(uuid, uuid, text) to service_role;
grant execute on function public.lf_idempotency_finish(uuid, jsonb) to service_role;
