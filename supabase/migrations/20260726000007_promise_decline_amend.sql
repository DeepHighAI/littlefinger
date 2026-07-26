-- 거절 · 수정 제안 — 02_세부기능명세서 §4-3-4 (T-04 · T-05).
--
-- 같은 토큰, 같은 화면(SCR-W02), 세 갈래 중 나머지 둘이다. 승인(T-03)은 ACTIVE 로 가고
-- 이 둘은 각각 DECLINED · DRAFT 로 간다. 셋 다 초대를 소모하고(1회용, §4-3-1) 작성자에게
-- 알림을 남긴다.
--
-- **승인과 다른 점은 종료일뿐이다.** 종료일이 지난 약속은 승인할 수 없지만(EC-B10),
-- EC-B10 이 지정한 탈출구가 바로 [종료일 변경 요청하기] = 수정 제안이다. 여기에 종료일
-- 가드를 달면 그 탈출구가 막혀 약속이 PENDING 에 영구히 갇힌다. 거절도 같은 이유로 막지
-- 않는다 — 만료된 약속을 거절조차 못 할 이유가 없다.
--
-- 알림(NT-02 · NT-03)은 이 함수 밖이다. 승인과 같은 이유다(EC-C02) — 반환 payload 만으로
-- 껍데기가 알림을 만들 수 있게, 상대 닉네임·프로필을 payload 에 담는다.

-- ============================================================
-- 입력 정규화 — §2-3
-- ============================================================

-- `packages/shared/src/text.ts` 의 `normalizeInput` 과 **같은 규칙**을 SQL 로 옮긴 것이다.
-- 두 구현이 존재하는 이유는 lf_content_hash 와 같다 — 이 함수는 입력이 클라이언트 경로를
-- 거쳐 왔다고 가정할 수 없다. 껍데기가 정규화를 빠뜨려도 저장되는 값과 글자 수 판정은
-- 서버가 책임진다(§2-3 "서버 검증이 최종").
--
-- 순서가 규칙의 일부다.
--   1. 제어문자 제거를 **NFC 보다 먼저** — 자모 사이에 낀 제어문자가 조합을 막는다.
--      (0x00 은 Postgres text 에 애초에 담기지 않으므로 범위가 0x01 부터다.)
--   2. NFC — PO 결정 2026-07-26. 조합형 자모를 완성형으로 합쳐야 글자 수가 맞는다.
--   3. 개행 3줄 이상 축약, 4. trim.
--
-- trim 은 btrim 이 아니다. btrim 의 기본 대상은 공백 한 종류뿐인데, TS 쪽 `String.trim()` 은
-- 개행과 유니코드 공백(NBSP·U+2000~200A·U+FEFF 등)까지 지운다. btrim 을 쓰면 "\n제안\n" 이
-- 두 구현에서 다른 길이로 세어진다.
create or replace function public.lf_normalize_input(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             normalize(
               -- 1. 개행만 남기고 제어문자를 지운다. NUL(U+0000) 은 Postgres text 에
               --    애초에 담기지 않으므로 범위가 U+0001 부터다.
               regexp_replace(coalesce(p_value, ''),
                              '[\u0001-\u0009\u000B-\u001F\u007F-\u009F]', '', 'g'),
               -- 2. NFC
               NFC
             ),
             -- 3. 개행 3줄 이상은 2줄로
             E'\n{3,}', E'\n\n', 'g'
           ),
           -- 4. trim. JS String.trim() 이 지우는 문자 중 1단계를 거치고도 남는 것만 적는다 —
           --    탭·수직탭·폼피드·CR 은 1단계에서 제어문자로 이미 사라졌다.
           '^[\u0020\u000A\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+'
             || '|[\u0020\u000A\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$',
           '',
           'g'
         );
$$;

comment on function public.lf_normalize_input is
  '사용자 입력 정규화 (02 §2-3). 제어문자 제거 → NFC → 개행 축약 → trim. packages/shared 의 normalizeInput 과 같은 규칙이다.';

-- ============================================================
-- 토큰 잠금 + 응답자 검증 — §4-3-5 1·2단계에서 종료일을 뺀 부분
-- ============================================================

-- 거절과 수정 제안이 **한 글자도 다르지 않은** 가드를 쓴다. 판정 순서가 어긋나면 같은
-- 토큰에 대해 화면과 서버가 서로 다른 답을 내고, 사용자는 열리는 링크에 응답할 수 없게 된다.
-- 순서를 한 곳에 두는 것이 이 함수의 존재 이유다.
--
-- `lf_promise_approve` 는 아직 이 함수를 쓰지 않는다. 이미 출하돼 변이 테스트까지 끝난
-- 함수라 이번 범위에서 건드리지 않았고, 대신 세 함수의 판정 순서가 같다는 사실을
-- promise-decline-amend.test.ts 의 교차 테스트가 직접 붙든다. 승인을 이 함수로 접는 것은
-- 후속 작업이다(handoff 참조).
create or replace function public.lf_invite_lock_for_response(
  p_token_hash char(64),
  p_user_id    uuid,
  out o_invitation_id uuid,
  out o_promise_id    uuid,
  out o_creator_id    uuid
)
language plpgsql
as $$
declare
  v_status      public.invitation_status;
  v_target_role public.participant_role;
  v_lapsed      boolean;
begin
  -- 초대 행만 잠근다. `of i` 를 빼면 조인한 promises 행까지 잠겨 경합 범위가 넓어진다.
  -- 잠금 순서는 언제나 invitations → promises 다. 승인·무효화 경로와 같은 순서여야
  -- 데드락이 나지 않는다(EC-C03).
  select i.id, i.promise_id, i.status, i.target_role, i.expires_at <= now(), p.creator_id
    into o_invitation_id, o_promise_id, v_status, v_target_role, v_lapsed, o_creator_id
    from public.invitations i
    join public.promises p on p.id = i.promise_id
   where i.token_hash = p_token_hash
     for update of i;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- 저장된 status 가 시계보다 **먼저**다. J-04 는 30분마다 돌기 때문에(§7-2)
  -- status='PENDING' 인데 expires_at 은 이미 지난 구간이 존재한다.
  if v_status = 'REVOKED' then
    raise exception 'E_INVITE_REVOKED';
  end if;

  if v_status = 'USED' then
    raise exception 'E_INVITE_USED';
  end if;

  if v_status = 'EXPIRED' or v_lapsed then
    raise exception 'E_INVITE_EXPIRED';
  end if;

  -- 증인 토큰으로는 당사자 응답을 할 수 없다. §4-5-1 은 증인이 상태 전이에 어떠한 영향도
  -- 주지 않는다고 못박는다 — 증인이 거절로 약속을 끝낼 수 있다면 그 문장이 무너진다.
  -- raise 는 전체를 롤백하므로 증인 초대는 PENDING 그대로 남아 M3 에서 그대로 쓸 수 있다.
  if v_target_role <> 'PARTNER' then
    raise exception 'E_FORBIDDEN';
  end if;

  -- 자기 초대 검사가 중복 역할 검사보다 **먼저**다. 작성자는 항상 CREATOR 참여자 행을
  -- 갖고 있어서, 순서가 바뀌면 모든 자기 응답이 E_DUPLICATE_ROLE 로 잘못 보고된다.
  if p_user_id = o_creator_id then
    raise exception 'E_SELF_INVITE';
  end if;

  -- 한 사람이 한 약속에서 두 역할을 가질 수 없고(§2-1), 다른 사람이 이미 PARTNER 자리를
  -- 차지했으면 자리가 없다. **자기 자신의 PARTNER 행**은 막지 않는다 — 수정 제안(T-05)이
  -- 상대 user_id 를 미리 남기므로, 막으면 재발송 후 응답이 영구히 불가능해진다.
  if exists (
    select 1
      from public.promise_participants
     where promise_id = o_promise_id
       and (
         (user_id = p_user_id and role <> 'PARTNER')
         or (role = 'PARTNER' and user_id is not null and user_id <> p_user_id)
       )
  ) then
    raise exception 'E_DUPLICATE_ROLE';
  end if;

  -- 차단은 **양방향**이다. §4-3-5 는 방향이 아니라 "차단 관계 없음"이라고 적는다.
  -- 내용을 볼 수 없는 사람(EC-B11)은 거절도 수정 제안도 할 수 없다.
  if exists (
    select 1
      from public.blocks
     where (blocker_id, blocked_user_id) in ((o_creator_id, p_user_id), (p_user_id, o_creator_id))
  ) then
    raise exception 'E_BLOCKED';
  end if;
end;
$$;

comment on function public.lf_invite_lock_for_response is
  '초대 행 잠금 + 응답자 검증 (02 §4-3-5 1·2단계). 거절·수정 제안이 같은 판정 순서를 쓰도록 한 곳에 모았다.';

-- ============================================================
-- 거절 — T-04 (PENDING → DECLINED)
-- ============================================================

create or replace function public.lf_promise_decline(
  p_idempotency_key uuid,
  p_token_hash      char(64),
  p_user_id         uuid,
  p_reason          text,
  p_surface         public.surface,
  p_ip_hash         char(64),
  p_ua_hash         char(64)
)
returns jsonb
language plpgsql
as $$
declare
  -- §5-3. 거절 사유는 **선택**이다(O-D2 · S-4 기본안). 0~200자.
  c_reason_max constant int := 200;

  v_cached      jsonb;
  v_inv_id      uuid;
  v_promise_id  uuid;
  v_creator_id  uuid;
  v_reason      text;
  v_ver         public.promise_versions%rowtype;
  v_hash        char(64);
  v_closed_at   timestamptz;
  v_rows        int;
  v_response    jsonb;
begin
  -- 없는 사용자면 idempotency_keys 의 FK 가 먼저 터져 E_* 가 아닌 500 이 나간다.
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'E_AUTH_REQUIRED';
  end if;

  -- 멱등 클레임이 **가장 먼저**다(§7-3.6). 잠금보다 뒤에 두면 두 번째 탭이 초대 행에서
  -- 대기하다 USED 를 읽고 E_INVITE_USED 를 던진다 — EC-C01 이 요구한 "첫 결과 그대로"가 아니다.
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'promise-decline');
  if v_cached is not null then
    return v_cached;
  end if;

  select c.o_invitation_id, c.o_promise_id, c.o_creator_id
    into v_inv_id, v_promise_id, v_creator_id
    from public.lf_invite_lock_for_response(p_token_hash, p_user_id) c;

  -- 길이 판정은 토큰·응답자 가드 **뒤**다. 승인이 종료일 검증을 두는 자리와 같다 —
  -- 만료된 링크에 사유를 길게 적어 보낸 사람에게 알려야 할 것은 길이가 아니라 만료다.
  v_reason := nullif(public.lf_normalize_input(p_reason), '');
  if char_length(coalesce(v_reason, '')) > c_reason_max then
    raise exception 'E_VALIDATION';
  end if;

  -- 확정 전 버전 행. 승인과 달리 이 함수는 버전을 확정하지 않는다 — 아래 approvals 행에
  -- **무엇을 거절했는지** 남기기 위해서만 읽는다. 0행·2행은 불변식 위반이라 조용히 넘기지 않는다.
  select * into strict v_ver
    from public.promise_versions
   where promise_id = v_promise_id
     and activated_at is null;

  -- DRAFT 시점 해시는 클라이언트가 RLS 로 직접 넣은 값이라 신뢰 대상이 아니다. 다시 계산한다.
  v_hash := public.lf_content_hash(v_ver.title, v_ver.body, v_ver.category, v_ver.end_date,
                                   v_ver.keeper, v_ver.reward, v_ver.penalty, v_ver.version_no);

  -- 상태 전이는 조건부 UPDATE 로만 한다(§7-3.1).
  -- closed_at 은 T-04 의 부수 효과 목록에 없지만 채운다. DECLINED 는 **완전 종결**이고
  -- (§2-4) closed_at 은 "종결 시각"으로 정의된 컬럼이다(§6-2). 비워 두면 종결 상태인데
  -- 종결 시각이 없는 행이 생긴다.
  update public.promises
     set status = 'DECLINED',
         closed_at = now(),
         lock_version = lock_version + 1,
         updated_at = now()
   where id = v_promise_id
     and status = 'PENDING'
  returning closed_at into v_closed_at;

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 참여자 기록 — T-04 는 (PARTNER, DECLINED) 를 요구한다.
  -- 그냥 INSERT 하면 안 된다. 이전 라운드의 수정 제안(T-05)이 남긴 PARTNER 행이 있을 수
  -- 있고, 그러면 부분 유니크 인덱스에 걸려 E_* 가 아닌 raw 23505 가 나간다.
  -- joined_at 은 비운다 — 거절한 사람은 참여한 적이 없다.
  update public.promise_participants
     set user_id = p_user_id,
         status = 'DECLINED'
   where promise_id = v_promise_id
     and role = 'PARTNER'
     and (user_id = p_user_id or user_id is null);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    insert into public.promise_participants (promise_id, user_id, role, status)
    values (v_promise_id, p_user_id, 'PARTNER', 'DECLINED');
  end if;

  -- 승인 로그는 **한 행**이다. 작성자의 발송=승인(§4-3-6)은 확정 경로의 규칙이고,
  -- 거절된 약속에 작성자의 APPROVE 를 남기면 성립하지 않은 합의를 기록하는 셈이 된다.
  -- content_hash 를 남기는 이유: 재발송 후 DRAFT 가 덮어써지면 이 행이 "무엇을 거절했는지"에
  -- 대한 유일한 증거가 된다. version_id 만으로는 v1 이 덮어써진 뒤 내용을 특정할 수 없다.
  insert into public.approvals
    (promise_id, version_id, user_id, role, action, content_hash, comment, surface,
     ip_hash, user_agent_hash)
  values
    (v_promise_id, v_ver.id, p_user_id, 'PARTNER', 'DECLINE', v_hash, v_reason, p_surface,
     p_ip_hash, p_ua_hash);

  -- 초대 소모. 조건부 UPDATE 가 EC-B06 의 마지막 방어선이다.
  update public.invitations
     set status = 'USED',
         used_by = p_user_id,
         used_at = now()
   where id = v_inv_id
     and status = 'PENDING'
     and used_at is null;

  if not found then
    raise exception 'E_INVITE_USED';
  end if;

  -- 종결 상태로 전이하면 해당 약속의 미발송 스케줄을 **전부** 취소한다(§8-2).
  -- PENDING 시점에 살아 있는 것은 INVITE_EXPIRE_SOON 뿐이지만, 종류를 좁혀 적으면
  -- 나중에 다른 스케줄이 생겼을 때 조용히 새어 나간다.
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = v_promise_id
     and status = 'PENDING';

  -- NT-02 는 이 payload 만으로 만들어진다. 제목이 "{상대}님이 약속을 거절했어요"라
  -- 닉네임이 없으면 껍데기가 두 번째 조회를 해야 한다.
  select jsonb_build_object(
           'promise_id', v_promise_id,
           'status',     'DECLINED',
           'closed_at',  v_closed_at,
           'creator_id', v_creator_id,
           -- 알림 본문. 원본인 버전 행에서 읽는다(§6-2).
           'title',      v_ver.title,
           'partner',    jsonb_build_object(
                           'user_id',           pu.id,
                           'nickname',          pu.nickname,
                           'profile_image_url', pu.profile_image_url
                         ),
           'reason',     v_reason
         )
    into v_response
    from public.users pu
   where pu.id = p_user_id;

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);

  return v_response;
end;
$$;

comment on function public.lf_promise_decline is
  '거절 (02 §4-3-4 · T-04). 알림을 제외한 전 단계를 한 트랜잭션에서 수행하고, 실패 시 전체 롤백한다.';

-- ============================================================
-- 수정 제안 — T-05 (PENDING → DRAFT)
-- ============================================================

create or replace function public.lf_promise_amend_suggest(
  p_idempotency_key uuid,
  p_token_hash      char(64),
  p_user_id         uuid,
  p_comment         text,
  p_surface         public.surface,
  p_ip_hash         char(64),
  p_ua_hash         char(64)
)
returns jsonb
language plpgsql
as $$
declare
  -- §5-3. 수정 제안 의견은 **필수** 5~300자. T-05 의 선행 조건이기도 하다.
  c_comment_min constant int := 5;
  c_comment_max constant int := 300;

  v_cached     jsonb;
  v_inv_id     uuid;
  v_promise_id uuid;
  v_creator_id uuid;
  v_comment    text;
  v_length     int;
  v_ver        public.promise_versions%rowtype;
  v_hash       char(64);
  v_rows       int;
  v_response   jsonb;
begin
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'E_AUTH_REQUIRED';
  end if;

  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'promise-amend');
  if v_cached is not null then
    return v_cached;
  end if;

  select c.o_invitation_id, c.o_promise_id, c.o_creator_id
    into v_inv_id, v_promise_id, v_creator_id
    from public.lf_invite_lock_for_response(p_token_hash, p_user_id) c;

  -- **종료일 가드가 없는 것이 이 함수의 요점이다.** EC-B10 은 종료일이 지난 약속의
  -- 유일한 출구로 [종료일 변경 요청하기] = 수정 제안을 지정한다. 여기서 종료일을 보면
  -- 그 출구가 닫히고 약속이 PENDING 에 갇힌다.
  --
  -- char_length 는 코드포인트로 센다(§2-3). 정규화 뒤에 세는 순서를 바꾸면, 조합형 자모로
  -- 입력된 "가속"이 2자가 아니라 5자로 잡혀 멀쩡한 의견이 반려된다.
  v_comment := public.lf_normalize_input(p_comment);
  v_length := char_length(v_comment);
  if v_length < c_comment_min or v_length > c_comment_max then
    raise exception 'E_VALIDATION';
  end if;

  select * into strict v_ver
    from public.promise_versions
   where promise_id = v_promise_id
     and activated_at is null;

  v_hash := public.lf_content_hash(v_ver.title, v_ver.body, v_ver.category, v_ver.end_date,
                                   v_ver.keeper, v_ver.reward, v_ver.penalty, v_ver.version_no);

  -- DRAFT 회귀. 버전 행은 그대로 두고 내용도 건드리지 않는다 — 무엇을 고칠지는 작성자가
  -- SCR-A03 에서 정하고, DRAFT 수정은 v1 을 덮어쓴다.
  update public.promises
     set status = 'DRAFT',
         lock_version = lock_version + 1,
         updated_at = now()
   where id = v_promise_id
     and status = 'PENDING';

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- T-05 가 명시적으로 요구하는 단계다 — "상대 user_id 를 participants 에 기록(재발송 시
  -- 직접 알림용)". 아직 참여한 것은 아니므로 INVITED 이고 joined_at 은 비운다.
  update public.promise_participants
     set user_id = p_user_id,
         status = 'INVITED'
   where promise_id = v_promise_id
     and role = 'PARTNER'
     and (user_id = p_user_id or user_id is null);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    insert into public.promise_participants (promise_id, user_id, role, status)
    values (v_promise_id, p_user_id, 'PARTNER', 'INVITED');
  end if;

  -- 의견은 approvals.comment 에 남는다. 작성자가 재작성할 때 읽는 유일한 근거이고,
  -- content_hash 는 그 의견이 **어느 내용**에 대한 것이었는지를 고정한다. 재작성이 v1 을
  -- 덮어쓰고 나면 다른 방법으로는 복원할 수 없다.
  insert into public.approvals
    (promise_id, version_id, user_id, role, action, content_hash, comment, surface,
     ip_hash, user_agent_hash)
  values
    (v_promise_id, v_ver.id, p_user_id, 'PARTNER', 'AMEND_SUGGEST', v_hash, v_comment, p_surface,
     p_ip_hash, p_ua_hash);

  update public.invitations
     set status = 'USED',
         used_by = p_user_id,
         used_at = now()
   where id = v_inv_id
     and status = 'PENDING'
     and used_at is null;

  if not found then
    raise exception 'E_INVITE_USED';
  end if;

  -- DRAFT 는 종결이 아니므로 §8-2 의 일괄 취소 규칙이 걸리지 않는다. 그래도 초대는
  -- 소모됐으므로 "초대가 곧 만료돼요"(NT-04)는 거짓이 된다. 그 한 종류만 끈다.
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = v_promise_id
     and kind = 'INVITE_EXPIRE_SOON'
     and status = 'PENDING';

  -- NT-03 의 딥링크는 SCR-A03(재작성)이다. 제목의 "{상대}"와 본문의 의견이 여기서 나온다.
  select jsonb_build_object(
           'promise_id', v_promise_id,
           'status',     'DRAFT',
           'creator_id', v_creator_id,
           -- 알림 본문. 버전 행에서 읽어야 하는 이유가 여기서 가장 분명하다 — DRAFT 로 돌아간
           -- 뒤 작성자가 SCR-A03 에서 제목을 고쳐도, 알림에는 제안받은 시점의 제목이 남는다.
           'title',      v_ver.title,
           'partner',    jsonb_build_object(
                           'user_id',           pu.id,
                           'nickname',          pu.nickname,
                           'profile_image_url', pu.profile_image_url
                         ),
           'comment',    v_comment
         )
    into v_response
    from public.users pu
   where pu.id = p_user_id;

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);

  return v_response;
end;
$$;

comment on function public.lf_promise_amend_suggest is
  '수정 제안 (02 §4-3-4 · T-05). PENDING → DRAFT 회귀. 종료일 경과 약속의 유일한 출구이므로 종료일을 검사하지 않는다(EC-B10).';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- `from public` 만으로는 닫히지 않는다 — Supabase 가 anon·authenticated 에게 직접 부여한다.
revoke all on function public.lf_normalize_input(text) from public, anon, authenticated;
revoke all on function public.lf_invite_lock_for_response(char(64), uuid)
  from public, anon, authenticated;
revoke all on function public.lf_promise_decline(uuid, char(64), uuid, text, public.surface, char(64), char(64))
  from public, anon, authenticated;
revoke all on function public.lf_promise_amend_suggest(uuid, char(64), uuid, text, public.surface, char(64), char(64))
  from public, anon, authenticated;

grant execute on function public.lf_normalize_input(text) to service_role;
grant execute on function public.lf_invite_lock_for_response(char(64), uuid) to service_role;
grant execute on function public.lf_promise_decline(uuid, char(64), uuid, text, public.surface, char(64), char(64))
  to service_role;
grant execute on function public.lf_promise_amend_suggest(uuid, char(64), uuid, text, public.surface, char(64), char(64))
  to service_role;
