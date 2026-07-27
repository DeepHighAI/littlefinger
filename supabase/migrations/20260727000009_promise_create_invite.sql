-- 약속 생성 · 초대 발급 — 02_세부기능명세서 §4-2-2 · §4-3-1 (T-01 · T-02).
--
-- 이 두 전이가 함께 있는 이유는 편의가 아니다. SCR-A03 의 주 CTA [상대에게 보내기]는 한 번의
-- 사용자 행동으로 DRAFT 를 만들고 곧바로 보낸다(§4-2-1). 클라이언트가 두 번 호출하면 그 사이
-- 실패가 고아 DRAFT 를 남기고, 사용자는 성공도 실패도 아닌 상태를 본다. 그래서 합성 경로가
-- **한 트랜잭션**이다(PO 결정 2026-07-27).
--
-- **원문 토큰은 이 파일에 존재하지 않는다.** 껍데기가 32바이트 CSPRNG 로 만들어 해시만
-- 넘긴다(§4-3-1, §13 "초대 토큰 원문이 DB·로그 어디에도 저장되지 않는다"). 해시 규칙은
-- `supabase/functions/_shared/hash.ts` 의 `inviteTokenHash` 하나뿐이고, 발급하는 쪽과
-- 조회하는 쪽(`lf_invite_resolve`)이 같은 함수를 쓴다 — 어긋나면 멀쩡한 링크가 전부
-- E_NOT_FOUND 로 죽고 다른 증상이 없다.
--
-- **작성자의 `approvals` 행은 여기서 쓰지 않는다.** §7-1 T-02 의 "예약 기록"은 말 그대로
-- 예약이다 — §4-3-5 5단계가 승인 시점에 **2행**(작성자·상대방)을 함께 쓰라고 명시하고,
-- `approvals.content_hash` 는 확정 해시라 ACTIVE 이전에는 존재하지도 않는다. `lf_promise_approve`
-- 가 이미 `i.created_at` 을 작성자의 `acted_at` 으로 써서 §4-3-6 을 만족한다.

-- ============================================================
-- 정책 수치 — 코드에 박지 않는다
-- ============================================================

-- 전부 `packages/shared/src/config.ts` 와 짝이고, SQL 이 그 파일을 읽을 수 없으므로
-- `supabase/tests/promise-create-invite.test.ts` 가 값을 대조한다(lf_idempotency_ttl_minutes 선례).

create or replace function public.lf_draft_max_concurrent()
returns int
language sql
immutable
as $$
  select 20;
$$;

create or replace function public.lf_promise_max_per_day()
returns int
language sql
immutable
as $$
  select 30;
$$;

create or replace function public.lf_end_date_max_days()
returns int
language sql
immutable
as $$
  select 365;
$$;

create or replace function public.lf_invite_ttl_hours()
returns int
language sql
immutable
as $$
  select 72;
$$;

create or replace function public.lf_invite_resend_max()
returns int
language sql
immutable
as $$
  select 10;
$$;

-- §8-2 "INVITE_EXPIRE_SOON — expires_at 12시간 전". §11-3 설정값 표에는 없어서
-- config.ts 에 `INVITE_EXPIRE_SOON_LEAD_HOURS` 를 함께 새로 넣었다.
create or replace function public.lf_invite_expire_soon_lead_hours()
returns int
language sql
immutable
as $$
  select 12;
$$;

-- ============================================================
-- 행위자 검증
-- ============================================================

-- 없는 사용자면 idempotency_keys 의 FK 가 먼저 터져 E_* 가 아닌 500 이 나간다(0006 선례).
-- §4-2 선행 조건이 `users.status = ACTIVE` 까지 요구하므로 그것도 함께 본다. F-03 은 상태를
-- 명시하지 않지만 같은 사람이 같은 저작 행위를 이어 하는 것이라 같은 기준을 쓴다 —
-- 아니면 정지된 계정이 초대 링크를 계속 뿌릴 수 있다.
create or replace function public.lf_assert_actor(p_user_id uuid)
returns void
language plpgsql
stable
as $$
declare
  v_status public.user_status;
begin
  select status into v_status from public.users where id = p_user_id;

  if not found then
    raise exception 'E_AUTH_REQUIRED';
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'E_FORBIDDEN';
  end if;
end;
$$;

comment on function public.lf_assert_actor is
  '행위자 검증 (02 §4-2 선행 조건). 없는 사용자는 E_AUTH_REQUIRED, ACTIVE 아닌 계정은 E_FORBIDDEN.';

-- ============================================================
-- 내용 필드 검증 — §5-1
-- ============================================================

-- 이 함수가 따로 존재하는 이유는 `lf_invite_lock_for_response` 와 같다. T-01 은 사용자 입력을,
-- T-02 는 저장된 버전 행을 검사하는데(§7-1 T-02 선행 조건 "§5-1 필수 필드 전부 유효"),
-- 두 경로의 규칙이 갈리면 앱에서 만들어진 약속을 앱이 보내지 못하는 상태가 생긴다.
--
-- **종료일은 여기 없다.** T-01 과 T-02 의 종료일 규칙이 서로 다르기 때문이다 — 아래 각
-- 함수의 주석을 볼 것.
--
-- 입력은 **이미 정규화된** 값이다. char_length 는 코드포인트로 세므로(§2-3) 정규화 전에
-- 세면 조합형 자모로 입력된 "가속"이 2자가 아니라 5자로 잡힌다.
--
-- 필드 이름을 실어 보내지 않는다. 껍데기가 `packages/shared/src/validation.ts` 로 먼저 같은
-- 규칙을 돌려 §5 문구와 필드 이름을 붙이고, 이 함수는 그 뒤를 받는 최종 판정이다(§2-3
-- "서버 검증이 최종"). 여기까지 내려온 위반은 두 구현이 어긋났다는 뜻이므로 공통 문구가 맞다.
create or replace function public.lf_assert_promise_content(
  p_title    text,
  p_body     text,
  p_category text,
  p_keeper   text,
  p_reward   text,
  p_penalty  text
)
returns void
language plpgsql
immutable
as $$
declare
  v_title_length int := char_length(coalesce(p_title, ''));
  v_body_length  int := char_length(coalesce(p_body, ''));
begin
  -- 제목 2~40자, 개행 불가.
  if v_title_length < 2 or v_title_length > 40 or p_title like E'%\n%' then
    raise exception 'E_VALIDATION';
  end if;

  -- 본문 5~1000자, 개행 허용하되 최대 20줄.
  -- 줄 수는 개행 개수 + 1 이다. lf_normalize_input 이 3줄 이상 연속 개행을 2줄로 줄인 뒤라
  -- 여기서 세는 값은 사용자가 실제로 보는 줄 수와 같다.
  if v_body_length < 5 or v_body_length > 1000
     or (length(p_body) - length(replace(p_body, E'\n', ''))) + 1 > 20 then
    raise exception 'E_VALIDATION';
  end if;

  -- enum 은 캐스팅 전에 문자열로 검사한다. 바로 캐스팅하면 잘못된 값이 22P02 로 터져
  -- E_* 가 아닌 500 이 나가고, 그 메시지에 타입 이름이 실린다.
  if p_category is null or p_category not in ('HABIT', 'BET', 'MONEY', 'ETC') then
    raise exception 'E_VALIDATION';
  end if;

  if p_keeper is null or p_keeper not in ('CREATOR', 'PARTNER', 'BOTH') then
    raise exception 'E_VALIDATION';
  end if;

  -- 보상·벌칙은 선택이고 상한만 있다(0~100자).
  if char_length(coalesce(p_reward, '')) > 100
     or char_length(coalesce(p_penalty, '')) > 100 then
    raise exception 'E_VALIDATION';
  end if;
end;
$$;

comment on function public.lf_assert_promise_content is
  '약속 내용 필드 검증 (02 §5-1). 정규화된 값을 받는다. 종료일은 T-01·T-02 규칙이 달라 제외.';

-- ============================================================
-- T-01 — — → DRAFT (§4-2-2)
-- ============================================================

-- 약속 1행 + 버전 1행(v1) + 참여자 1행(CREATOR)을 만든다. 셋은 나뉠 수 없다 —
-- 버전 없는 약속은 `content_hash` NOT NULL 때문에 애초에 존재할 수 없고, 참여자 행 없는
-- 약속은 RLS 헬퍼가 읽지 못한다.
--
-- **`current_version_id` 는 채우지 않는다.** 그건 *활성* 버전이고 확정(T-03) 때 정해진다.
-- 여기서 채우면 `lf_invite_resolve` 가 캐시 대신 버전 테이블을 봐도 된다고 착각할 여지가
-- 생기는데, 그 함수는 확정 전 초대를 다루는 것이 존재 이유다.
create or replace function public.lf_promise_create_draft(
  p_user_id         uuid,
  p_title           text,
  p_body            text,
  p_category        text,
  p_end_date        text,
  p_keeper          text,
  p_reward          text,
  p_penalty         text,
  p_witness_enabled boolean
)
returns uuid
language plpgsql
as $$
declare
  v_title      text := public.lf_normalize_input(p_title);
  v_body       text := public.lf_normalize_input(p_body);
  v_reward     text := nullif(public.lf_normalize_input(p_reward), '');
  v_penalty    text := nullif(public.lf_normalize_input(p_penalty), '');
  -- §5-1 기본값. 미선택이면 CTA 가 비활성이지만(§5-1 #3) 지킬 사람은 기본값이 있다.
  v_keeper     text := coalesce(nullif(btrim(p_keeper), ''), 'BOTH');
  v_end_date   date;
  v_today_kst  date := (now() at time zone 'Asia/Seoul')::date;
  v_days       int;
  v_promise_id uuid;
begin
  -- 날짜 캐스팅은 예외 블록 안에서 한다. 밖에서 하면 '2026-02-30' 같은 값이 22007 로 터져
  -- E_* 가 아닌 500 이 나간다.
  begin
    v_end_date := p_end_date::date;
  exception
    when others then
      raise exception 'E_VALIDATION';
  end;

  perform public.lf_assert_promise_content(v_title, v_body, p_category, v_keeper,
                                           v_reward, v_penalty);

  -- §5-1 #4 — **내일 ~ 오늘+365**, KST(S-7). 오늘을 배제하는 것은 T-01 규칙이다.
  -- T-02·T-03 은 "미경과"(오늘 포함)를 쓴다 — CHECKING 이 종료일 **익일** 00:00 에
  -- 시작하므로(§2-2) 종료일 당일은 아직 지키는 날이기 때문이다.
  v_days := v_end_date - v_today_kst;
  if v_days < 1 or v_days > public.lf_end_date_max_days() then
    raise exception 'E_VALIDATION';
  end if;

  -- EC-H05 남용 방지. 두 한도 모두 E_RATE_LIMIT 이다.
  -- 동시 보유 DRAFT 가 먼저다 — 그쪽이 "정리하면 바로 풀리는" 한도라 사용자가 할 수 있는
  -- 일이 있고, 일일 한도는 내일까지 아무것도 할 수 없다.
  if (select count(*) from public.promises
       where creator_id = p_user_id and status = 'DRAFT') >= public.lf_draft_max_concurrent() then
    raise exception 'E_RATE_LIMIT';
  end if;

  -- 일일 한도의 기준은 **KST 캘린더 일**이다(PO 결정 2026-07-27). EC-H05 의 사용자 문구가
  -- "오늘은 더 만들 수 없습니다. **내일** 다시 시도해 주세요."인데, 롤링 24시간이면 그 안내가
  -- 거짓말이 된다. daily_metrics 의 날짜 키와도 같은 기준이다.
  --
  -- 살아 있는 행을 센다. DRAFT 를 지우면 그만큼 다시 만들 수 있다는 뜻인데, 그 우회로
  -- 얻는 것이 없어서 그대로 둔다 — 지울 수 있는 것은 자기 DRAFT 뿐이고(§4-2-2.5), 보낸
  -- 약속은 PENDING 이라 지워지지 않는다. 쌓이는 것을 막는 쪽은 위의 동시 보유 한도다.
  if (select count(*) from public.promises
       where creator_id = p_user_id
         and (created_at at time zone 'Asia/Seoul')::date = v_today_kst)
     >= public.lf_promise_max_per_day() then
    raise exception 'E_RATE_LIMIT';
  end if;

  insert into public.promises
    (creator_id, status, title, body, category, end_date, keeper, reward, penalty,
     witness_enabled)
  values
    (p_user_id, 'DRAFT', v_title, v_body, p_category::public.promise_category, v_end_date,
     v_keeper::public.keeper, v_reward, v_penalty, coalesce(p_witness_enabled, false))
  returning id into v_promise_id;

  -- 내용의 **원본은 버전 행**이고 promises 의 같은 컬럼은 조회·배치용 캐시다(§4-2-2.1).
  -- content_hash 는 여기서 계산하지만 법적 의미를 갖는 값은 ACTIVE 시점의 것이다(§4-2-2.2,
  -- F-04). 컬럼이 NOT NULL 이라 어차피 지금 채워야 한다.
  insert into public.promise_versions
    (promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
     content_hash, created_by)
  values
    (v_promise_id, 1, v_title, v_body, p_category::public.promise_category, v_end_date,
     v_keeper::public.keeper, v_reward, v_penalty,
     public.lf_content_hash(v_title, v_body, p_category::public.promise_category, v_end_date,
                            v_keeper::public.keeper, v_reward, v_penalty, 1),
     p_user_id);

  insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
  values (v_promise_id, p_user_id, 'CREATOR', 'JOINED', now());

  return v_promise_id;
end;
$$;

comment on function public.lf_promise_create_draft is
  'T-01 본체 (02 §4-2-2). 약속 + 버전 v1 + CREATOR 참여자를 함께 만든다. 멱등 클레임은 호출자 몫이다.';

-- ============================================================
-- T-02 — DRAFT → PENDING (§4-3-1 · §4-3-2)
-- ============================================================

-- 잠금 순서는 언제나 **invitations → promises** 다(0006 의 EC-C03 주석). 그래서 약속 행은
-- `for update` 없이 읽고, 상태 전이는 조건부 UPDATE 한 문장이 직렬화 지점을 맡는다(§7-3.1).
-- 여기서 약속을 먼저 잠그면 승인 경로(초대 잠금 → 약속 갱신)와 정확히 반대가 되어 데드락이 난다.
create or replace function public.lf_invite_issue_row(
  p_user_id    uuid,
  p_promise_id uuid,
  p_token_hash char(64)
)
returns jsonb
language plpgsql
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
  'T-02 본체 (02 §4-3-1). 토큰 해시만 받는다 — 원문은 껍데기 밖으로 나가지 않는다. 멱등 클레임은 호출자 몫이다.';

-- ============================================================
-- 공개 진입점 — 껍데기가 부르는 것은 이 둘뿐이다
-- ============================================================

-- `promise-create`. `p_token_hash` 가 NULL 이면 [임시저장](DRAFT 만), NULL 이 아니면
-- [상대에게 보내기](DRAFT + 발송)다. 두 갈래가 한 함수인 이유는 엔드포인트가 하나이기
-- 때문이다 — `lf_idempotency_begin` 이 (키, 사용자, 엔드포인트)를 한 쌍으로 저장하므로
-- 같은 슬러그가 두 엔드포인트 문자열을 쓰면 캐시가 갈라진다.
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

-- `promise-invite`. 이미 있는 DRAFT 를 보내거나(§4-2-1 [임시저장] 뒤의 발송),
-- PENDING 인 약속의 초대를 다시 보낸다(§4-3-2 [초대 다시 보내기]).
create or replace function public.lf_promise_invite(
  p_idempotency_key uuid,
  p_user_id         uuid,
  p_promise_id      uuid,
  p_token_hash      char(64)
)
returns jsonb
language plpgsql
as $$
declare
  v_cached   jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_user_id);

  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'promise-invite');
  if v_cached is not null then
    return v_cached;
  end if;

  v_response := public.lf_invite_issue_row(p_user_id, p_promise_id, p_token_hash);

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);

  return v_response;
end;
$$;

comment on function public.lf_promise_invite is
  '초대 발송·재발송 (02 §4-3-1, T-02). 기존 PARTNER 토큰을 REVOKED 로 바꾸고 새 토큰을 발급한다.';

-- ============================================================
-- 클라이언트 쓰기 경로 회수 — RLS
-- ============================================================

-- 0002 는 T-01 을 클라이언트가 RLS 로 직접 하는 설계였다. T-01 이 RPC 가 된 지금 이 정책들은
-- 죽은 코드가 아니라 **구멍**이다(PO 결정 2026-07-27).
--
-- 1. EC-H05 의 DRAFT 20건·일 30건 한도를 그냥 우회할 수 있다. 한도를 세는 곳이 RPC 뿐이다.
-- 2. `content_hash` 를 클라이언트가 임의 값으로 넣을 수 있다. §9 는 이 값을 서버 생산으로
--    못박았고, J-09 해시 검증 잡이 그걸 전제로 돈다.
-- 3. promise_versions 에는 UPDATE 정책이 없으므로, promises 캐시만 고칠 수 있는 이 조합은
--    원본과 캐시를 어긋나게 만든다 — 초대 랜딩은 캐시 제목을, 승인은 버전 내용을 읽는다.
--
-- promise_participants 에는 애초에 INSERT 정책이 없어서 클라이언트 단독 생성은 어차피
-- 불가능했다. 즉 이 정책들로 만들 수 있는 것은 **참여자 행 없는 반쪽 약속**뿐이었다.
--
-- DRAFT 수정(§4-2-2.4, v1 덮어쓰기)은 이 회수로 함께 닫힌다. 전용 RPC 가 생기기 전까지
-- 불가능하고, 그 화면은 아직 존재하지 않는다.
drop policy "promises insert own draft" on public.promises;
drop policy "promises update own draft" on public.promises;
drop policy "promise versions insert own draft" on public.promise_versions;

-- 삭제 정책은 남긴다. §4-2-2.5 가 "DRAFT 삭제는 작성자 단독, 하드 삭제"라고 적고
-- 무결성에 영향이 없다 — 지우는 것은 자기 DRAFT 뿐이고 참여자·버전은 cascade 로 함께 간다.

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- `from public` 만으로는 닫히지 않는다 — Supabase 가 anon·authenticated 에게 직접 부여한다.
-- 여기서 한 줄이라도 빠지면 클라이언트가 RPC 를 직접 불러 방금 회수한 경로를 되찾는다.
revoke all on function public.lf_draft_max_concurrent() from public, anon, authenticated;
revoke all on function public.lf_promise_max_per_day() from public, anon, authenticated;
revoke all on function public.lf_end_date_max_days() from public, anon, authenticated;
revoke all on function public.lf_invite_ttl_hours() from public, anon, authenticated;
revoke all on function public.lf_invite_resend_max() from public, anon, authenticated;
revoke all on function public.lf_invite_expire_soon_lead_hours() from public, anon, authenticated;
revoke all on function public.lf_assert_actor(uuid) from public, anon, authenticated;
revoke all on function public.lf_assert_promise_content(text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.lf_promise_create_draft(uuid, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.lf_invite_issue_row(uuid, uuid, char(64))
  from public, anon, authenticated;
revoke all on function public.lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char(64))
  from public, anon, authenticated;
revoke all on function public.lf_promise_invite(uuid, uuid, uuid, char(64))
  from public, anon, authenticated;

grant execute on function public.lf_draft_max_concurrent() to service_role;
grant execute on function public.lf_promise_max_per_day() to service_role;
grant execute on function public.lf_end_date_max_days() to service_role;
grant execute on function public.lf_invite_ttl_hours() to service_role;
grant execute on function public.lf_invite_resend_max() to service_role;
grant execute on function public.lf_invite_expire_soon_lead_hours() to service_role;
grant execute on function public.lf_assert_actor(uuid) to service_role;
grant execute on function public.lf_assert_promise_content(text, text, text, text, text, text)
  to service_role;
grant execute on function public.lf_promise_create_draft(uuid, text, text, text, text, text, text, text, boolean)
  to service_role;
grant execute on function public.lf_invite_issue_row(uuid, uuid, char(64)) to service_role;
grant execute on function public.lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char(64))
  to service_role;
grant execute on function public.lf_promise_invite(uuid, uuid, uuid, char(64)) to service_role;
