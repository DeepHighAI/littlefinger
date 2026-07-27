-- 약속 검토 조회 — 02_세부기능명세서 §4-3-4 (SCR-W02, 로그인 **후**).
--
-- SCR-W02 는 서버 읽기 경로가 없어서 지금까지 아무것도 그릴 수 없었다. 있는 것 중
-- 어느 것도 이 화면을 채우지 못한다:
--   · `lf_invite_resolve` 는 로그인 전 화면(SCR-W01)용이라 **돌려주지 않는 것**이
--     설계의 본질이다. 넓히면 그 설계가 사라진다(PO 가 기각, 2026-07-27).
--   · RLS 도 답이 아니다. PENDING 시점의 상대방에게는 `promise_participants` 행이
--     아직 없다 — T-01 은 CREATOR 행만 만들고 PARTNER 행은 `lf_promise_approve`
--     **안에서**, 즉 승인 뒤에 생긴다. `can_read_promise()` 가 false 라 select 는 빈 결과다.
--
-- 그래서 이 함수가 존재한다. 승인의 **읽기 쌍둥이**다 — 같은 토큰에 같은 판정을 내리고,
-- 통과했을 때만 §4-3-4 의 표시 요소를 돌려준다.
--
-- **버전 이력(§4-3-4 에 없음)은 담지 않는다.** SCR-W02 에 이력을 보일지는 미해결 항목이고,
-- 확정 전 제안본의 이력을 상대에게 어디까지 보이는지는 정책 판단이라 여기서 정하지 않는다.

create or replace function public.lf_invite_preview(
  p_token_hash char(64),
  p_user_id    uuid
)
returns jsonb
language plpgsql
-- `lf_invite_resolve` 와 같은 이유로 `stable` 이다. 계획 최적화가 아니라 **강제 장치**다 —
-- Postgres 가 이 함수 안에서 INSERT/UPDATE/DELETE 를, 그리고 `select … for update` 까지
-- 거부한다. 검토 화면은 새로고침·뒤로가기로 몇 번이든 다시 열리는 자리라(EC-A01),
-- 읽기 한 번이 초대를 소모하면 사용자는 자기가 방금 본 약속을 승인할 수 없게 된다.
--
-- 그래서 `lf_invite_lock_for_response` 를 재사용하지 **못한다**. 그쪽은 `for update of i` 로
-- 초대 행을 잠그는데 그것이 읽기 전용이 아니다. 판정 순서를 여기 다시 적는 대신 잠금을
-- 들여오면 읽기 경로가 승인 경로와 같은 행에서 경합하게 된다.
stable
as $$
declare
  v_promise_id      uuid;
  v_creator_id      uuid;
  v_inv_status      public.invitation_status;
  v_target_role     public.participant_role;
  v_lapsed          boolean;
  v_promise_status  public.promise_status;
  v_witness_enabled boolean;
  v_ver             public.promise_versions%rowtype;
  v_payload         jsonb;
begin
  -- 행위자 검증이 토큰 조회보다 **먼저**다. 없는 사용자에게 토큰의 존재 여부를 알려 줄
  -- 이유가 없다.
  perform public.lf_assert_actor(p_user_id);

  -- 작성자는 `promises.creator_id` 로 찾는다. `invitations.created_by` 가 아니다 —
  -- §4-5-2 에서 증인 초대는 상대방도 보낼 수 있어서, created_by 로 조인하면 그 경우에만
  -- 엉뚱한 사람이 작성자로 표시된다(`lf_invite_resolve` 와 같은 이유).
  select i.promise_id, i.status, i.target_role, i.expires_at <= now(),
         p.creator_id, p.status, p.witness_enabled
    into v_promise_id, v_inv_status, v_target_role, v_lapsed,
         v_creator_id, v_promise_status, v_witness_enabled
    from public.invitations i
    join public.promises p on p.id = i.promise_id
   where i.token_hash = p_token_hash;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- ── 토큰 판정 — `lf_invite_resolve` 와 **완전히 같은 순서** ────────────
  -- 랜딩(SCR-W01)·검토(SCR-W02)·승인이 같은 토큰에 다른 답을 내면, 열리는 링크를
  -- 승인할 수 없거나 열리지 않는 링크를 승인할 수 있는 상태가 생긴다.
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

  -- ── 열람자 판정 — `lf_promise_approve` 와 같은 순서 ────────────────────
  -- 이 네 가드가 **내용보다 먼저**여야 한다는 것이 PO 결정(2026-07-27)이다. 승인이
  -- 거부할 사람에게 전문을 보여 주면 그 자체가 읽기 경로의 유출이다 — 특히 작성자가
  -- 자기 링크를 열었을 때 내용이 보이면 링크가 엉뚱한 사람에게 갔는지 알 길이 사라진다.

  -- 증인 링크로는 이 화면에 오지 않는다. EC-D05 는 확정 전 증인에게 "제목·작성자만"을
  -- 주는데 그건 SCR-W01 이 이미 하는 일이고, 증인 열람은 ACTIVE 이후 SCR-W05 다(M3).
  if v_target_role <> 'PARTNER' then
    raise exception 'E_FORBIDDEN';
  end if;

  -- 자기 초대 검사가 중복 역할 검사보다 **먼저**다. 작성자는 항상 CREATOR 참여자 행을
  -- 갖고 있어서, 순서가 바뀌면 모든 자기 열람이 E_DUPLICATE_ROLE 로 잘못 보고된다.
  if p_user_id = v_creator_id then
    raise exception 'E_SELF_INVITE';
  end if;

  -- 한 사람이 한 약속에서 두 역할을 가질 수 없고(§2-1), 다른 사람이 이미 PARTNER 면
  -- 자리가 없다. **자기 자신의 PARTNER 행**은 막지 않는다 — 수정 제안(T-05)이 상대
  -- user_id 를 미리 남기므로, 막으면 재발송 후 검토가 영구히 불가능해진다.
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

  -- 차단은 **양방향**이다. EC-B11 은 차단 관계에서 내용 노출을 막으므로, 승인보다
  -- 오히려 이 함수에서 더 직접적으로 필요한 가드다.
  if exists (
    select 1
      from public.blocks
     where (blocker_id, blocked_user_id) in ((v_creator_id, p_user_id), (p_user_id, v_creator_id))
  ) then
    raise exception 'E_BLOCKED';
  end if;

  -- 명세 밖. 승인은 조건부 UPDATE(`where status='PENDING'`) 한 문장이 이 판정을 겸하는데,
  -- `stable` 인 이 함수에는 그 문장이 없다. 빼면 승인할 수 없는 약속의 전문이 보인다 —
  -- 예컨대 T-18(상대 탈퇴 → DECLINED)로 종결된 뒤 초대가 PENDING 으로 남은 경우다.
  if v_promise_status <> 'PENDING' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- **종료일은 여기서 보지 않는다.** 승인은 EC-B10 으로 거절하지만, 그 화면을 그리려면
  -- 내용이 필요하다 — §4-3-4 는 종료일이 지난 약속에도 전문을 띄운 채 버튼만 비활성화하고
  -- [종료일 변경 요청하기]를 노출하라고 한다. 여기서 막으면 그 출구가 사라진다.

  -- 확정 전 버전 행. 내용의 원본은 언제나 `promise_versions` 이고 promises 의 같은
  -- 컬럼은 캐시다(§4-2-2.1) — 둘이 어긋나면 버전 테이블이 정답이다(EC-C04).
  -- 0행·2행은 불변식 위반이므로 조용히 넘기지 않는다.
  select * into strict v_ver
    from public.promise_versions
   where promise_id = v_promise_id
     and activated_at is null;

  -- §4-3-4 표시 요소: 약속 전문 · 종료일 · 보상/벌칙 · 지킬 사람 · 작성자 프로필 ·
  -- 증인 사용 예정 여부. 디스클레이머는 클라이언트 상수다(`LEGAL_DISCLAIMER`).
  --
  -- **종료일은 날짜 그대로 보낸다.** D-Day 는 `packages/shared/src/datetime.ts` 가 KST 로
  -- 계산한다 — 서버가 미리 계산해 문자열로 보내면 자정을 넘긴 화면이 갱신되지 않는다.
  --
  -- 증인 여부는 `promises` 에서 읽는다. `promise_versions` 에는 그 컬럼이 없다 —
  -- 증인은 내용이 아니라 약속의 속성이다(§6-2).
  -- 위 버전 조회와 같은 이유로 `strict` 다. 작성자 행이 없으면 `v_payload` 가 NULL 로 남고
  -- 껍데기는 그것을 본문 `null` 인 **200** 으로 내보낸다 — 내용 없는 성공이 제일 나쁜 답이다.
  select jsonb_build_object(
           'title',           v_ver.title,
           'body',            v_ver.body,
           'category',        v_ver.category,
           'end_date',        v_ver.end_date,
           'keeper',          v_ver.keeper,
           'reward',          v_ver.reward,
           'penalty',         v_ver.penalty,
           'witness_enabled', v_witness_enabled,
           'creator',         jsonb_build_object(
                                'nickname',          u.nickname,
                                'profile_image_url', u.profile_image_url
                              )
         )
    into strict v_payload
    from public.users u
   where u.id = v_creator_id;

  return v_payload;
end;
$$;

comment on function public.lf_invite_preview is
  '약속 검토 조회 (02 §4-3-4). 승인의 읽기 쌍둥이 — 같은 가드를 통과했을 때만 SCR-W02 표시 요소를 돌려준다.';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- `from public` 만으로는 닫히지 않는다 — Supabase 는 public 스키마에
-- `alter default privileges … grant all on functions to anon, authenticated` 를 걸어 둔다.
-- 여기서 `authenticated` 한 줄이 빠지면, 로그인만 한 사람이 토큰 해시를 들고 직접 호출해
-- 이 함수를 두드릴 수 있게 된다.
revoke all on function public.lf_invite_preview(char(64), uuid) from public, anon, authenticated;
grant execute on function public.lf_invite_preview(char(64), uuid) to service_role;
