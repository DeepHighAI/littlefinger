-- 유료 약속 슬롯 (PO 2026-08-24).
--
-- 무료 슬롯 5개: 내가 **작성자**인 '진행 중'(§4-1-4: PENDING·ACTIVE·AMEND_PENDING·CHECKING)
-- 약속이 5개 미만일 때만 초대 발송(T-02)이 가능하다. 종결되면 슬롯은 되돌아오고, DRAFT 는
-- 기존 20건 한도를 그대로 쓴다. 구매 슬롯은 영구 +1(용량 = 5 + 구매 수).
--
-- 강제 지점은 lf_invite_issue_row 하나다 — T-02 본체라서 세 진입점(promise-create 의 발송
-- 분기, promise-invite, promise-draft-update 의 발송 분기)이 전부 이 함수를 지난다.
-- 부여는 purchase-verify Edge Function 이 Google Play Developer API 검증을 마친 뒤
-- lf_slot_grant 로만 한다 — 클라이언트 영수증은 신뢰하지 않는다.
--
-- **잠금 순서 불변식 (Codex 검증 2026-08-25): 슬롯 advisory 잠금은 promises·promise_versions·
-- invitations 행 잠금보다 언제나 먼저다.** draft-update 는 내용 행을 먼저 잠근 뒤 T-02 에
-- 들어오므로, 그대로 두면 invite 경로(advisory → 행)와 순환 대기가 성립한다. 그래서 발송이
-- 있는 두 진입점(lf_promise_create·lf_promise_draft_update)이 행을 건드리기 전에
-- lf_slot_lock 을 선취득하고, lf_assert_slot_available 의 재획득은 같은 트랜잭션이라 no-op 이다.

-- ============================================================
-- 정책 수치 — 코드에 박지 않는다 (0009 의 lf_draft_max_concurrent 선례)
-- ============================================================

-- packages/shared/src/config.ts 의 FREE_PROMISE_SLOTS 와 짝. SQL 은 그 파일을 읽을 수
-- 없으므로 supabase/tests/paid-slots.test.ts 가 값을 대조한다.
create or replace function public.lf_free_promise_slots()
returns int
language sql
immutable
set search_path = ''
as $$
  select 5;
$$;

-- ============================================================
-- slot_purchases — 구매 이력. append-only, 수정·삭제 불가.
-- ============================================================

create table public.slot_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  provider text not null check (provider = 'google_play'),
  product_id text not null,
  -- Play 주문 ID. 같은 주문의 재검증(네트워크 재시도·미소모 복구)을 멱등으로 만드는 키다.
  order_id text not null unique,
  -- 구매 토큰 원문. §8-8 의 해시 규칙은 초대 토큰·IP·UA 가 대상이다 — 이 토큰은 환불 대사와
  -- 재검증에 원문이 필요하고, unique 가 계정 간 토큰 재사용의 최후 방벽이다.
  purchase_token text not null unique,
  purchase_time timestamptz not null,
  granted_slots int not null default 1 check (granted_slots > 0),
  created_at timestamptz not null default now()
);

create index slot_purchases_user_idx on public.slot_purchases (user_id);

alter table public.slot_purchases enable row level security;

-- 하드닝 기준선(0020): 정책이 부여하지 않는 동사의 grant 를 남기지 않는다.
-- Supabase 는 새 테이블에 anon·authenticated 전체 동사를 기본 부여하므로 즉시 회수한다.
-- public 은 기본 부여가 없지만 함수와 같은 3중 회수를 감사 기준선으로 못박는다(Codex 2026-08-25).
revoke all on table public.slot_purchases from public, anon, authenticated;
grant select on table public.slot_purchases to authenticated;

-- 자기 구매 이력만 읽는다. 쓰기 정책은 아예 없다 — 부여는 서버 RPC(lf_slot_grant)만 한다.
-- (select auth.uid()) 는 init-plan 강제 — 행마다 재평가되는 bare 호출을 기준선이 금지한다.
create policy "slot purchases read own" on public.slot_purchases
  for select using ((select auth.uid()) = user_id);

-- 0018(account_safety)의 탈퇴 계정 경계를 새 테이블에도 동일하게 건다.
create policy "active account boundary" on public.slot_purchases
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());

-- ============================================================
-- 집계 — 사용량·용량·현황
-- ============================================================

create or replace function public.lf_slot_used(p_user_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  -- §4-1-4 '진행 중' 4개 상태의 CREATOR 한정판. 상대방으로 수락한 약속은 슬롯을 쓰지 않는다.
  select count(*)::int
    from public.promises p
   where p.creator_id = p_user_id
     and p.status in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING');
$$;

create or replace function public.lf_slot_capacity(p_user_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select public.lf_free_promise_slots()
       + coalesce((select sum(sp.granted_slots)::int
                     from public.slot_purchases sp
                    where sp.user_id = p_user_id), 0);
$$;

-- slot-status Edge Function 전용 읽기.
create or replace function public.lf_slot_status(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform public.lf_assert_actor(p_actor);
  return pg_catalog.jsonb_build_object(
    'capacity', public.lf_slot_capacity(p_actor),
    'used',     public.lf_slot_used(p_actor)
  );
end;
$$;

comment on function public.lf_slot_status is
  '슬롯 현황 (PO 2026-08-24). used 는 작성자 기준 진행 중 카운트, capacity 는 무료 + 구매 합.';

-- ============================================================
-- 부여 — purchase-verify 가 Google 검증을 마친 뒤에만 부른다
-- ============================================================

create or replace function public.lf_slot_grant(
  p_user_id        uuid,
  p_product_id     text,
  p_order_id       text,
  p_purchase_token text,
  p_purchase_time  timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  perform public.lf_assert_actor(p_user_id);

  -- 같은 주문의 재검증은 조용히 0행 — 부여는 주문당 한 번이다(멱등).
  insert into public.slot_purchases
    (user_id, provider, product_id, order_id, purchase_token, purchase_time, granted_slots)
  values
    (p_user_id, 'google_play', p_product_id, p_order_id, p_purchase_token, p_purchase_time, 1)
  on conflict (order_id) do nothing;

  -- 0행의 두 원인을 가른다: 내 주문의 재검증은 정상, **남의 주문 재사용은 거부**.
  -- Edge 의 계정 바인딩 검사가 먼저 막지만, 이 함수 단독으로도 성립해야 한다.
  if not found then
    perform 1 from public.slot_purchases
      where order_id = p_order_id and user_id = p_user_id;
    if not found then
      raise exception 'E_VALIDATION';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'capacity', public.lf_slot_capacity(p_user_id),
    'used',     public.lf_slot_used(p_user_id)
  );
end;
$$;

comment on function public.lf_slot_grant is
  '슬롯 +1 부여. 호출 전에 purchase-verify 가 Play Developer API 로 구매를 검증했어야 한다.';

-- ============================================================
-- 발송 가드 — T-02 앞에서만 소모를 검사한다
-- ============================================================

-- 잠금 키의 정의는 이 함수 하나뿐이다 — 진입점 선취득과 가드가 다른 키를 잡는 순간
-- 순서 불변식이 조용히 무너지므로, 키 문자열을 두 곳에 적지 않는다.
create or replace function public.lf_slot_lock(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_slot:' || p_user_id::text, 0)
  );
end;
$$;

create or replace function public.lf_assert_slot_available(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- 두 발송이 동시에 마지막 슬롯을 세면 둘 다 통과한다 — 사용자 단위 advisory 잠금이
  -- 카운트와 전이 커밋 사이를 직렬화한다(lf_recompute_trust_profile 의 수법, 키만 다르다).
  -- 발송 진입점은 행 잠금 전에 lf_slot_lock 을 이미 잡았다 — 같은 트랜잭션의 재획득은 no-op 이다.
  perform public.lf_slot_lock(p_user_id);
  if public.lf_slot_used(p_user_id) >= public.lf_slot_capacity(p_user_id) then
    raise exception 'E_SLOT_LIMIT';
  end if;
end;
$$;

-- ============================================================
-- lf_invite_issue_row 재정의 — 0009 본문 + 슬롯 가드 한 블록.
-- create or replace 는 0020(security_hardening)이 alter 로 심은 search_path 설정을
-- 지우므로 같은 값을 정의에 직접 싣는다(0021 의 선례).
-- ============================================================

create or replace function public.lf_invite_issue_row(
  p_user_id    uuid,
  p_promise_id uuid,
  p_token_hash char(64)
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_creator_id   uuid;
  v_status       public.promise_status;
  v_ver          public.promise_versions%rowtype;
  v_prev_id      uuid;
  v_prev_resend  int;
  v_resend_count int;
  v_expires_at   timestamptz;
  v_invitation_id uuid;
begin
  -- 존재하지 않는 약속과 남의 약속은 **같은 답**이다. 비참여자에게 약속의 존재를 알리지
  -- 않는다(§9 원칙 1). DRAFT·PENDING 구간의 참여자는 작성자뿐이라 작성자 검사가 곧 참여자 검사다.
  select p.creator_id, p.status
    into v_creator_id, v_status
    from public.promises p
   where p.id = p_promise_id;

  if not found or v_creator_id <> p_user_id then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_status not in ('DRAFT', 'PENDING') then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 확정 전 버전 행. 0행·2행은 불변식 위반이므로 조용히 넘기지 않는다.
  select * into strict v_ver
    from public.promise_versions
   where promise_id = p_promise_id
     and activated_at is null;

  -- §7-1 T-02 선행 조건 "§5-1 필수 필드 전부 유효".
  perform public.lf_assert_promise_content(v_ver.title, v_ver.body, v_ver.category::text,
                                           v_ver.keeper::text, v_ver.reward, v_ver.penalty);

  -- 종료일 규칙이 상태에 따라 갈린다. **막을 수 있는 사람이 고칠 수 있을 때만 막는다.**
  --
  --   DRAFT — §7-1 T-02 의 "종료일 미경과"를 건다. 걸려도 작성자가 SCR-A03 에서 날짜를
  --     고쳐 다시 보내면 된다. 오늘을 포함하는 것은 승인(§4-3-5, EC-B10)과 같은 기준이다.
  --   PENDING(재발송) — **걸지 않는다.** 이미 PENDING 이면 작성자는 내용을 고칠 수 없고,
  --     EC-B10 이 지정한 유일한 출구는 상대방의 [종료일 변경 요청하기](= 수정 제안, T-05)다.
  --     그런데 그 출구는 **유효한 링크가 있어야** 쓸 수 있다. 만료된 초대 + 지난 종료일
  --     상태에서 재발송까지 막으면 약속이 PENDING 에 영구히 갇힌다. 거절·수정 제안 경로에
  --     종료일 가드를 달지 않은 것과 정확히 같은 이유다(0007 헤더 주석).
  if v_status = 'DRAFT' and v_ver.end_date < (now() at time zone 'Asia/Seoul')::date then
    raise exception 'E_VALIDATION';
  end if;

  -- 유료 슬롯(PO 2026-08-24). 소모가 일어나는 전이는 DRAFT → PENDING 뿐이다 — 재발송은
  -- 이미 자기 슬롯 위에 서 있으므로 다시 검사하면 만석 사용자의 재발송이 부당하게 막힌다.
  -- 내용·종료일 검증 **뒤**가 자리다(PO 2026-08-25): 슬롯을 먼저 물으면 "결제했는데 여전히
  -- 못 보내는" 약속에 결제 시트를 띄우게 된다.
  if v_status = 'DRAFT' then
    perform public.lf_assert_slot_available(p_user_id);
  end if;

  -- 직전 PARTNER 초대. 있으면 재발송이다(§4-3-1).
  -- `target_role` 로 반드시 걸러야 한다 — F-05 증인 초대가 같은 테이블을 쓰므로, 빼면
  -- 증인을 부를 때마다 상대 초대가 무효화된다.
  select i.id, i.resend_count
    into v_prev_id, v_prev_resend
    from public.invitations i
   where i.promise_id = p_promise_id
     and i.target_role = 'PARTNER'
   order by i.created_at desc, i.id desc
   limit 1;

  v_resend_count := case when v_prev_id is null then 0 else v_prev_resend + 1 end;

  -- EC-B08 — 1약속당 재발송 INVITE_RESEND_MAX(10)회. 최초 발송은 재발송이 아니라 0 이다.
  if v_resend_count > public.lf_invite_resend_max() then
    raise exception 'E_RATE_LIMIT';
  end if;

  -- 기존 토큰 **즉시 REVOKED**(§4-3-1). PENDING 인 것만 바꾼다 — USED·EXPIRED 를 덮어쓰면
  -- 그 초대에 실제로 무슨 일이 있었는지가 지워지고, `lf_invite_resolve` 의 EC-B02 분기가
  -- 참여자 본인을 알아볼 근거를 잃는다.
  update public.invitations
     set status = 'REVOKED'
   where promise_id = p_promise_id
     and target_role = 'PARTNER'
     and status = 'PENDING';

  v_expires_at := now() + make_interval(hours => public.lf_invite_ttl_hours());

  insert into public.invitations
    (promise_id, target_role, token_hash, created_by, expires_at, status,
     resend_count, parent_invitation_id)
  values
    (p_promise_id, 'PARTNER', p_token_hash, p_user_id, v_expires_at, 'PENDING',
     v_resend_count, v_prev_id)
  returning id into v_invitation_id;

  -- 상태 전이는 조건부 UPDATE 로만(§7-3.1). 재발송은 PENDING → PENDING 이라 상태가 그대로다
  -- (§4-3-2 "약속 상태는 PENDING 유지"). 0행이면 그 사이 다른 전이가 끼어든 것이다.
  update public.promises
     set status = 'PENDING',
         lock_version = lock_version + 1,
         updated_at = now()
   where id = p_promise_id
     and status in ('DRAFT', 'PENDING');

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 명세 밖. 무효화된 초대의 "곧 만료" 예약을 취소한다. 두면 이미 REVOKED 된 토큰을 두고
  -- 작성자에게 NT-04 가 나간다. ACTIVE 전환에서 같은 처리를 하는 것과 같은 이유다(0006).
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = p_promise_id
     and kind = 'INVITE_EXPIRE_SOON'
     and status = 'PENDING';

  -- NT-04 예약(§8-2). 수신자는 작성자뿐이다(§8-1 NT-04 수신자 열이 'C').
  -- TTL 72시간에 12시간 전이라 fire_at 은 언제나 미래다 — 과거 시점 배제 조건이 없는 이유다.
  insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
  values (p_promise_id, p_user_id, 'INVITE_EXPIRE_SOON',
          v_expires_at - make_interval(hours => public.lf_invite_expire_soon_lead_hours()));

  -- daily_metrics.invite_sent_count 는 **건드리지 않는다.** §4-3 어디에도 요구가 없고,
  -- 짝이 되는 invite_accepted_count 를 승인 경로가 올리지 않으므로 여기만 올리면 두 지표가
  -- 서로 다른 규칙으로 채워진다. 이 컬럼들은 J-07(일 지표 집계)이 원본 테이블에서 세는 몫이다.

  -- 껍데기가 "이번 호출이 실제로 발급했는가"를 판정할 수 있어야 한다. 멱등 재시도라면
  -- 캐시된 payload 가 돌아오는데, 그 payload 의 해시는 이번에 만든 토큰의 해시와 다르다.
  -- 그 대조 없이 새 토큰을 응답에 실으면 **DB 에 없는 토큰으로 만든 링크**가 사용자에게 가고,
  -- 증상은 E_NOT_FOUND 하나뿐이라 추적할 단서가 없다.
  return jsonb_build_object(
    'promise_id',    p_promise_id,
    'status',        'PENDING',
    'invitation_id', v_invitation_id,
    'token_hash',    p_token_hash,
    'expires_at',    v_expires_at,
    'resend_count',  v_resend_count,
    'title',         v_ver.title
  );
end;
$$;

comment on function public.lf_invite_issue_row is
  'T-02 본체 (02 §4-3-1) + 슬롯 가드(PO 2026-08-24). 토큰 해시만 받는다 — 원문은 껍데기 밖으로 나가지 않는다. 멱등 클레임은 호출자 몫이다.';

-- ============================================================
-- 발송 진입점 재정의 — 잠금 순서 불변식의 나머지 절반.
-- 본문은 각각 0009·0011(promise_draft_update_revoke)과 동일하고, 발송 분기의
-- lf_slot_lock 선취득 한 블록만 다르다. 멱등 클레임 뒤·행 접근 전이 자리다 —
-- 멱등 행은 (키, 사용자, 엔드포인트) 전용이라 advisory 와 순환을 만들 수 없다.
-- ============================================================

create or replace function public.lf_promise_create(
  p_idempotency_key uuid,
  p_user_id         uuid,
  p_title           text,
  p_body            text,
  p_category        text,
  p_end_date        text,
  p_keeper          text,
  p_reward          text,
  p_penalty         text,
  p_witness_enabled boolean,
  p_token_hash      char(64)
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_cached     jsonb;
  v_promise_id uuid;
  v_response   jsonb;
begin
  perform public.lf_assert_actor(p_user_id);

  -- 멱등 클레임이 **가장 먼저**다(§7-3.6). 뒤로 미루면 두 번 눌린 [상대에게 보내기]가
  -- 약속을 두 개 만든다 — EC-H05 의 한도가 아니라 이 클레임이 그걸 막는다.
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'promise-create');
  if v_cached is not null then
    return v_cached;
  end if;

  -- 발송이면 행을 만들기 전에 슬롯 잠금부터. 잠금 순서 불변식(파일 머리)의 이행이다.
  if p_token_hash is not null then
    perform public.lf_slot_lock(p_user_id);
  end if;

  v_promise_id := public.lf_promise_create_draft(p_user_id, p_title, p_body, p_category,
                                                 p_end_date, p_keeper, p_reward, p_penalty,
                                                 p_witness_enabled);

  if p_token_hash is null then
    v_response := jsonb_build_object('promise_id', v_promise_id, 'status', 'DRAFT');
  else
    v_response := public.lf_invite_issue_row(p_user_id, v_promise_id, p_token_hash);
  end if;

  -- 작업과 **같은 트랜잭션**에서 캐시한다. 실패하면 클레임까지 롤백돼 재시도가 정상 실행된다.
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);

  return v_response;
end;
$$;

comment on function public.lf_promise_create is
  '약속 생성 (02 §4-2-2, T-01). token_hash 가 있으면 초대 발송(T-02)까지 한 트랜잭션에서 수행한다.';

create or replace function public.lf_promise_draft_update(
  p_idempotency_key uuid,
  p_user_id         uuid,
  p_promise_id      uuid,
  p_title           text,
  p_body            text,
  p_category        text,
  p_end_date        text,
  p_keeper          text,
  p_reward          text,
  p_penalty         text,
  p_witness_enabled boolean,
  p_token_hash      char(64)
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_cached       jsonb;
  v_creator_id   uuid;
  v_status       public.promise_status;
  v_title        text := public.lf_normalize_input(p_title);
  v_body         text := public.lf_normalize_input(p_body);
  v_reward       text := nullif(public.lf_normalize_input(p_reward), '');
  v_penalty      text := nullif(public.lf_normalize_input(p_penalty), '');
  v_keeper       text := coalesce(nullif(btrim(p_keeper), ''), 'BOTH');
  v_end_date     date;
  v_today_kst    date := (now() at time zone 'Asia/Seoul')::date;
  v_days         int;
  v_updated_rows int;
  v_response     jsonb;
begin
  perform public.lf_assert_actor(p_user_id);

  -- 같은 키의 두 저장이 버전 행을 두 번 덮어쓰지 않도록 내용 조회보다 먼저 클레임한다.
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_user_id, 'promise-draft-update'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  -- 발송이면 내용 행을 잠그기 전에 슬롯 잠금부터. 이 함수는 promises 행을 먼저 잡은 채
  -- T-02 로 들어가므로, 여기서 선취득하지 않으면 invite 경로(advisory → 행)와 순환 대기가
  -- 성립한다(Codex 2026-08-25 P1).
  if p_token_hash is not null then
    perform public.lf_slot_lock(p_user_id);
  end if;

  begin
    v_end_date := p_end_date::date;
  exception
    when others then
      raise exception 'E_VALIDATION';
  end;

  perform public.lf_assert_promise_content(
    v_title, v_body, p_category, v_keeper, v_reward, v_penalty
  );

  -- 새 DRAFT를 만드는 T-01과 같은 규칙이다. 수정이라고 오늘이나 1년 밖의 날짜를 허용하면
  -- 생성 경로를 한 번 거친 뒤 서버 정책을 우회할 수 있다.
  v_days := v_end_date - v_today_kst;
  if v_days < 1 or v_days > public.lf_end_date_max_days() then
    raise exception 'E_VALIDATION';
  end if;

  select p.creator_id, p.status
    into v_creator_id, v_status
    from public.promises p
   where p.id = p_promise_id;

  -- 존재하지 않는 약속과 남의 약속은 같은 답이다(§9 원칙 1).
  if not found or v_creator_id <> p_user_id then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_status <> 'DRAFT' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 조건부 UPDATE가 직렬화 지점이다. 위 조회 뒤 다른 전이가 끼어들면 0행이 되어 수정이
  -- 확정 뒤로 새지 않는다. 아래 버전 갱신이 먼저 실패해도 함수 트랜잭션 전체가 롤백된다.
  update public.promises
     set title = v_title,
         body = v_body,
         category = p_category::public.promise_category,
         end_date = v_end_date,
         keeper = v_keeper::public.keeper,
         reward = v_reward,
         penalty = v_penalty,
         witness_enabled = coalesce(p_witness_enabled, false),
         lock_version = lock_version + 1,
         updated_at = now()
   where id = p_promise_id
     and creator_id = p_user_id
     and status = 'DRAFT';

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows <> 1 then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 확정 전에는 버전을 추가하지 않고 v1 하나만 덮어쓴다(§4-2-2.4). 활성화된 행을 조건에서
  -- 제외해 상태 열이 잘못된 데이터에서도 확정 내용을 덮어쓰지 못하게 한다.
  update public.promise_versions
     set title = v_title,
         body = v_body,
         category = p_category::public.promise_category,
         end_date = v_end_date,
         keeper = v_keeper::public.keeper,
         reward = v_reward,
         penalty = v_penalty,
         content_hash = public.lf_content_hash(
           v_title, v_body, p_category::public.promise_category, v_end_date,
           v_keeper::public.keeper, v_reward, v_penalty, 1
         )
   where promise_id = p_promise_id
     and version_no = 1
     and activated_at is null;

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows <> 1 then
    -- 실제 데이터 불변식 위반이다. E_*로 위장하지 않아 껍데기가 공통 500으로 평탄화하게 한다.
    raise exception 'DRAFT version invariant violated';
  end if;

  if p_token_hash is null then
    v_response := jsonb_build_object('promise_id', p_promise_id, 'status', 'DRAFT');
  else
    -- 같은 함수 안에서 부르므로 내용 저장과 T-02는 함께 커밋되거나 함께 롤백된다.
    v_response := public.lf_invite_issue_row(p_user_id, p_promise_id, p_token_hash);
  end if;

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_promise_draft_update is
  'DRAFT v1과 조회 캐시 수정. token_hash가 있으면 같은 트랜잭션에서 T-02까지 실행한다.';

-- ============================================================
-- 실행 권한 — 서버만. create or replace 는 기존 ACL 을 보존하지만
-- 3중 revoke 는 감사 기준선이라 명시적으로 다시 못박는다(0021 의 선례).
-- ============================================================

revoke all on function public.lf_free_promise_slots() from public, anon, authenticated;
revoke all on function public.lf_slot_lock(uuid) from public, anon, authenticated;
revoke all on function public.lf_slot_used(uuid) from public, anon, authenticated;
revoke all on function public.lf_slot_capacity(uuid) from public, anon, authenticated;
revoke all on function public.lf_slot_status(uuid) from public, anon, authenticated;
revoke all on function public.lf_slot_grant(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_assert_slot_available(uuid) from public, anon, authenticated;
revoke all on function public.lf_invite_issue_row(uuid, uuid, char(64))
  from public, anon, authenticated;
revoke all on function public.lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char(64))
  from public, anon, authenticated;
revoke all on function public.lf_promise_draft_update(
  uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char(64)
) from public, anon, authenticated;

grant execute on function public.lf_free_promise_slots() to service_role;
grant execute on function public.lf_slot_lock(uuid) to service_role;
grant execute on function public.lf_slot_used(uuid) to service_role;
grant execute on function public.lf_slot_capacity(uuid) to service_role;
grant execute on function public.lf_slot_status(uuid) to service_role;
grant execute on function public.lf_slot_grant(uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.lf_assert_slot_available(uuid) to service_role;
grant execute on function public.lf_invite_issue_row(uuid, uuid, char(64)) to service_role;
grant execute on function public.lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char(64))
  to service_role;
grant execute on function public.lf_promise_draft_update(
  uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char(64)
) to service_role;
