-- 승인 트랜잭션 — 02_세부기능명세서 §4-3-5 (PENDING → ACTIVE).
--
-- 이 서비스에서 **부분 실패가 가장 비싼 지점**이다. `approvals` 와 `promise_versions` 는
-- append-only 라 잘못 남은 행을 지울 방법이 없다. 그래서 EC-C02 는 "하나라도 실패하면
-- 전체 롤백"을 요구하고, 그 요구가 이 로직을 Postgres 함수에 둔 이유다 — Supabase JS
-- 클라이언트로는 여러 문장을 한 트랜잭션에 묶을 수 없다(PO 결정 2026-07-26, ADR 0003).
--
-- 명세의 열 단계 중 **9번(알림)만 이 함수 밖**이다(EC-C02: "알림/푸시 이외의 모든 단계는
-- 하나의 트랜잭션"). 이 함수는 notifications 에 단 한 행도 쓰지 않는다. 껍데기가 커밋 후
-- 반환 payload 만으로 NT-01 을 만든다 — payload 가 상대 닉네임·프로필을 담는 이유다.
--
-- 명세의 번호는 서술 순서지 실행 순서가 아니다. content_hash 는 5단계(approvals)가
-- 요구하므로 6단계에서 앞으로 당겨 계산한다.

-- ============================================================
-- 정책 수치 — 코드에 박지 않는다
-- ============================================================

-- packages/shared/src/config.ts 의 REMINDER_OFFSETS_DAYS · REMINDER_SEND_HOUR_KST 와 짝이고,
-- SQL 이 그 파일을 읽을 수 없으므로 테스트가 두 값을 대조한다(lf_idempotency_ttl_minutes 선례).
create or replace function public.lf_reminder_offsets_days()
returns int[]
language sql
immutable
as $$
  select array[7, 3, 1, 0];
$$;

create or replace function public.lf_reminder_send_hour_kst()
returns int
language sql
immutable
as $$
  select 9;
$$;

-- ============================================================
-- 승인
-- ============================================================

create or replace function public.lf_promise_approve(
  p_idempotency_key uuid,
  p_token_hash      char(64),
  p_user_id         uuid,
  p_surface         public.surface,
  p_ip_hash         char(64),
  p_ua_hash         char(64)
)
returns jsonb
language plpgsql
as $$
declare
  v_cached       jsonb;
  v_inv_id       uuid;
  v_promise_id   uuid;
  v_inv_status   public.invitation_status;
  v_target_role  public.participant_role;
  v_invited_at   timestamptz;
  v_lapsed       boolean;
  v_creator_id   uuid;
  v_ver          public.promise_versions%rowtype;
  v_hash         char(64);
  v_activated_at timestamptz;
  v_rows         int;
  v_response     jsonb;
begin
  -- 명세 밖. 없는 사용자면 idempotency_keys 의 FK 가 먼저 터져 E_* 가 아닌 500 이 나간다.
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'E_AUTH_REQUIRED';
  end if;

  -- 멱등 클레임은 **가장 먼저**다(§7-3.6). 잠금보다 뒤에 두면 두 번째 탭이 초대 행에서
  -- 대기하다 USED 를 읽고 E_INVITE_USED 를 던진다 — EC-C01 이 요구한 "첫 결과 그대로"가 아니다.
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'promise-approve');
  if v_cached is not null then
    return v_cached;
  end if;

  -- ── 1단계. 토큰 검증 ────────────────────────────────────
  -- 초대 행만 잠근다. `of i` 를 빼면 조인한 promises·users 행까지 잠겨 경합 범위가 넓어진다.
  -- 잠금 순서는 언제나 invitations → promises 다. 무효화·거절 경로도 같은 순서를 써야
  -- 데드락이 나지 않는다(EC-C03).
  select i.id, i.promise_id, i.status, i.target_role, i.created_at,
         i.expires_at <= now(), p.creator_id
    into v_inv_id, v_promise_id, v_inv_status, v_target_role, v_invited_at, v_lapsed, v_creator_id
    from public.invitations i
    join public.promises p on p.id = i.promise_id
   where i.token_hash = p_token_hash
     for update of i;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- 판정 순서는 lf_invite_resolve 와 **완전히 같아야 한다**. 랜딩 화면과 승인 호출이
  -- 같은 토큰에 다른 답을 내면 사용자는 열리는 링크를 승인할 수 없게 된다.
  if v_inv_status = 'REVOKED' then
    raise exception 'E_INVITE_REVOKED';
  end if;

  if v_inv_status = 'USED' then
    raise exception 'E_INVITE_USED';
  end if;

  -- J-04 는 30분마다 돌므로 status='PENDING' 인데 이미 만료된 구간이 존재한다(§7-2).
  if v_inv_status = 'EXPIRED' or v_lapsed then
    raise exception 'E_INVITE_EXPIRED';
  end if;

  -- 증인 토큰은 이 함수가 받지 않는다. §4-5-1 은 "증인의 서명 여부는 상태 전이에 어떠한
  -- 영향도 주지 않는다"고 하므로 증인 수락은 애초에 다른 동작이다(M3, 별도 RPC).
  -- 여기서 raise 하면 전체가 롤백돼 증인 초대는 PENDING 그대로 남는다.
  if v_target_role <> 'PARTNER' then
    raise exception 'E_FORBIDDEN';
  end if;

  -- ── 2단계. 수락자 검증 ──────────────────────────────────
  -- 자기 초대 검사가 중복 역할 검사보다 **먼저**다. 작성자는 항상 CREATOR 참여자 행을
  -- 갖고 있어서, 순서가 바뀌면 모든 자기 수락이 E_DUPLICATE_ROLE 로 잘못 보고된다.
  if p_user_id = v_creator_id then
    raise exception 'E_SELF_INVITE';
  end if;

  -- 같은 사람이 한 약속에서 두 역할을 가질 수 없고(§2-1), 다른 사람이 이미 PARTNER 면
  -- 자리가 없다. 반대로 **자기 자신의 PARTNER 행**은 막지 않는다 — 수정 제안(T-05)이
  -- 상대 user_id 를 미리 남기므로, 막으면 재발송 후 승인이 영구히 불가능해진다.
  if exists (
    select 1
      from public.promise_participants
     where promise_id = v_promise_id
       and (
         (user_id = p_user_id and role <> 'PARTNER')
         or (role = 'PARTNER' and user_id is not null and user_id <> p_user_id)
       )
  ) then
    raise exception 'E_DUPLICATE_ROLE';
  end if;

  -- 차단은 **양방향**으로 본다. §4-3-5 는 방향이 아니라 "차단 관계 없음"이라고 적는다.
  -- blocks 는 RLS 상 차단한 본인만 읽을 수 있어(0002) 역방향은 서버만 볼 수 있다.
  if exists (
    select 1
      from public.blocks
     where (blocker_id, blocked_user_id) in ((v_creator_id, p_user_id), (p_user_id, v_creator_id))
  ) then
    raise exception 'E_BLOCKED';
  end if;

  -- 확정할 버전 행. **이 함수는 버전을 만들지 않는다** — T-01 이 약속과 v1 을 함께 만들고
  -- DRAFT 수정은 v1 을 덮어쓰므로 PENDING 시점에 이미 존재한다(content_hash 가 NOT NULL 인
  -- 것이 그 사실을 스키마로 못박는다). 0행·2행은 불변식 위반이므로 조용히 넘기지 않는다.
  select * into strict v_ver
    from public.promise_versions
   where promise_id = v_promise_id
     and activated_at is null;

  -- 종료일 경과 검증(EC-B10). D >= 0 이면 통과한다 — CHECKING 은 종료일 **익일** 00:00 KST 에
  -- 시작하므로(§2-2) 종료일 당일은 아직 지키는 날이고, 승인을 막을 근거가 없다.
  -- 날짜 경계는 서버가 KST 로 판단한다. current_date 는 UTC 라 쓰면 안 된다.
  if v_ver.end_date < (now() at time zone 'Asia/Seoul')::date then
    raise exception 'E_VALIDATION';
  end if;

  -- ── 6단계 전반. 내용 해시 ───────────────────────────────
  -- 재계산한다. DRAFT 시점 해시는 클라이언트가 RLS 로 직접 넣은 값이라 신뢰 대상이 아니다.
  -- 입력은 전부 버전 행에서 온다 — promises 캐시가 어긋나면 버전 테이블이 정답이다(EC-C04).
  v_hash := public.lf_content_hash(v_ver.title, v_ver.body, v_ver.category, v_ver.end_date,
                                   v_ver.keeper, v_ver.reward, v_ver.penalty, v_ver.version_no);

  -- ── 3단계. 상태 조건부 갱신 ─────────────────────────────
  -- 이 한 문장이 상태 전이의 직렬화 지점이다(§7-3.1). 잠근 초대 행 **밖에서** 도착한
  -- 상태 변경(T-18 상대 탈퇴 → DECLINED 등)이 여기서 걸린다.
  update public.promises
     set status = 'ACTIVE',
         activated_at = now(),
         current_version_id = v_ver.id,
         lock_version = lock_version + 1,
         updated_at = now()
   where id = v_promise_id
     and status = 'PENDING'
  returning activated_at into v_activated_at;

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- ── 6단계 후반. 버전 확정 ───────────────────────────────
  -- append-only 테이블이라 UPDATE 정책이 아예 없다. 이 서버 경로만 쓸 수 있다.
  update public.promise_versions
     set activated_at = v_activated_at,
         content_hash = v_hash
   where id = v_ver.id;

  -- ── 4단계. PARTNER 참여자 ───────────────────────────────
  -- 그냥 INSERT 하면 안 된다. 수정 제안(T-05)이 남긴 행이나 증인 초대용 자리 표시 행이
  -- 이미 있을 수 있고, 그러면 부분 유니크 인덱스에 걸려 E_* 가 아닌 raw 23505 가 나간다.
  update public.promise_participants
     set user_id = p_user_id,
         status = 'JOINED',
         joined_at = now()
   where promise_id = v_promise_id
     and role = 'PARTNER'
     and (user_id = p_user_id or user_id is null);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
    values (v_promise_id, p_user_id, 'PARTNER', 'JOINED', now());
  end if;

  -- ── 5단계. 승인 로그 2행 ────────────────────────────────
  -- 작성자의 승인 시각은 **초대 발송 시각**이다(§4-3-6) — 초대를 보낸 행위가 곧 승인이고,
  -- 확정 화면은 두 시각을 나란히 인쇄한다. 여기에 now() 를 쓰면 그 표시가 의미를 잃는다.
  -- 작성자의 ip/ua 는 NULL 이다. 발송 시점에 수집한 적이 없으므로 수락자의 값을 복사하면
  -- 하지도 않은 요청의 흔적을 감사 로그에 심는 셈이 된다.
  insert into public.approvals
    (promise_id, version_id, user_id, role, action, content_hash, surface,
     ip_hash, user_agent_hash, acted_at)
  values
    (v_promise_id, v_ver.id, v_creator_id, 'CREATOR', 'APPROVE', v_hash, 'APP',
     null, null, v_invited_at),
    (v_promise_id, v_ver.id, p_user_id, 'PARTNER', 'APPROVE', v_hash, p_surface,
     p_ip_hash, p_ua_hash, now());

  -- ── 7단계. 초대 소모 ────────────────────────────────────
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

  -- ── 8단계. 리마인드 ─────────────────────────────────────
  -- 수신자는 작성자와 상대방 **둘뿐**이다(§8-1 NT-06/07 수신자 열이 'C, P').
  -- participants 를 조인하면 안 된다 — F-05 가 PENDING 에서도 증인 참여를 허용하므로
  -- 이미 JOINED 인 증인이 딸려 들어온다.
  -- 발송 시각은 KST 벽시계 09:00 이고, **미래인 행만** 만든다(§8-2 "과거 시점은 생성하지 않음").
  insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
  select v_promise_id, t.user_id, t.kind, t.fire_at
    from (
      select u.user_id,
             (case when o.days = 0 then 'DDAY' else 'D' || o.days end)::public.reminder_kind as kind,
             ((v_ver.end_date - o.days)::timestamp
               + make_interval(hours => public.lf_reminder_send_hour_kst()))
               at time zone 'Asia/Seoul' as fire_at
        from (values (v_creator_id), (p_user_id)) as u(user_id)
        cross join unnest(public.lf_reminder_offsets_days()) as o(days)
    ) t
   where t.fire_at > now();

  -- 명세 밖. T-02 가 예약해 둔 "초대 곧 만료"(NT-04)를 취소한다. §8-2 의 취소 규칙은
  -- 종결 상태 전이에만 걸려 있고 ACTIVE 는 종결이 아니라, 두면 이미 확정된 약속에
  -- 만료 임박 알림이 나간다.
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = v_promise_id
     and kind = 'INVITE_EXPIRE_SOON'
     and status = 'PENDING';

  -- ── 10단계. 일 지표 ─────────────────────────────────────
  -- 날짜 키는 KST 다. UTC 로 잡으면 00:00~09:00 KST 의 확정이 전부 전날로 들어간다.
  -- date 가 기본키라 순수 UPDATE 는 그날 첫 확정에서 조용히 0행이 된다.
  insert into public.daily_metrics (date, activated_count)
  values ((now() at time zone 'Asia/Seoul')::date, 1)
  on conflict (date) do update
    set activated_count = public.daily_metrics.activated_count + 1,
        updated_at = now();

  -- ── 응답 ────────────────────────────────────────────────
  -- 9단계가 함수 밖이므로, 껍데기가 **두 번째 조회 없이** NT-01 을 만들 수 있어야 한다.
  -- 상대 닉네임·프로필은 장식이 아니다 — 작성자가 오수락을 즉시 알아채는 수단이다(EC-B04).
  select jsonb_build_object(
           'promise_id',   v_promise_id,
           'status',       'ACTIVE',
           'activated_at', v_activated_at,
           'creator_id',   v_creator_id,
           -- 알림 본문(SCR-A07 두 번째 줄)이 이 값이다. promises 의 캐시가 아니라 버전 행에서
           -- 읽는다 — 원본은 promise_versions 이고(§6-2), 전이 시점의 제목이 박혀야 한다.
           'title',        v_ver.title,
           'partner',      jsonb_build_object(
                             'user_id',           pu.id,
                             'nickname',          pu.nickname,
                             'profile_image_url', pu.profile_image_url
                           ),
           'version_no',   v_ver.version_no,
           'fingerprint',  public.lf_fingerprint(v_hash, v_ver.version_no),
           'approvals',    jsonb_build_array(
                             jsonb_build_object('role', 'CREATOR', 'nickname', cu.nickname,
                                                'acted_at', v_invited_at),
                             jsonb_build_object('role', 'PARTNER', 'nickname', pu.nickname,
                                                'acted_at', now())
                           )
         )
    into v_response
    from public.users pu
    join public.users cu on cu.id = v_creator_id
   where pu.id = p_user_id;

  -- 작업과 **같은 트랜잭션**에서 캐시한다. 실패하면 클레임까지 롤백돼 재시도가 정상 실행된다.
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);

  return v_response;
end;
$$;

comment on function public.lf_promise_approve is
  '승인 트랜잭션 (02 §4-3-5). 알림(9단계)을 제외한 전 단계를 한 트랜잭션에서 수행하고, 실패 시 전체 롤백한다.';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- `from public` 만으로는 닫히지 않는다 — Supabase 가 anon·authenticated 에게 직접 부여한다.
revoke all on function public.lf_reminder_offsets_days() from public, anon, authenticated;
revoke all on function public.lf_reminder_send_hour_kst() from public, anon, authenticated;
revoke all on function public.lf_promise_approve(uuid, char(64), uuid, public.surface, char(64), char(64))
  from public, anon, authenticated;

grant execute on function public.lf_reminder_offsets_days() to service_role;
grant execute on function public.lf_reminder_send_hour_kst() to service_role;
grant execute on function public.lf_promise_approve(uuid, char(64), uuid, public.surface, char(64), char(64))
  to service_role;
