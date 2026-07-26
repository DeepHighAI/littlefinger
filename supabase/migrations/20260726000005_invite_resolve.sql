-- 초대 토큰 조회 — 02_세부기능명세서 §4-3-3 (SCR-W01 초대 랜딩, 비로그인).
--
-- 서비스에서 **로그인 이전에 DB 를 건드리는 유일한 경로**다. 카톡으로 퍼진 링크는 의도한
-- 상대가 아닌 사람도 열 수 있다는 전제 위에 서 있으므로, 무엇을 돌려주느냐보다
-- **무엇을 돌려주지 않느냐**가 이 함수의 본질이다. §4-3-3 이 이유를 명시한다 — "링크 유출 대비".
--
-- 돌려주는 것: 작성자 닉네임 · 약속 제목 · 만료 시각 · 대상 역할.
-- 돌려주지 않는 것: 본문 · 보상 · 벌칙 · 종료일 · 카테고리 · 지킬 사람 · 증인 여부 ·
--   프로필 이미지. 전부 SCR-W02(로그인 후) 요소다.
--
-- 대상 역할(`target_role`)은 §4-3-3 이 열거하지 않았지만 반환한다. §4-3-3 은 로그인 후
-- 복귀 지점을 SCR-W02 로만 적었는데, §4-5-2 가 증인 링크에도 똑같은 1회용·72시간 규칙을
-- 주므로 증인도 이 화면에 도착한다. 역할을 모르면 보낼 곳을 정할 수 없다. 라우팅 정보일 뿐
-- 약속 내용이 아니며, EC-D05 도 확정 전 증인에게 "제목·작성자만" 노출로 같은 범위를 준다.
--
-- 실패는 **반환이 아니라 raise** 다. 그래야 실패 경로에 payload 가 존재할 수 없다.

create or replace function public.lf_invite_resolve(p_token_hash char(64))
returns jsonb
language plpgsql
-- stable 은 계획 최적화가 아니라 **강제 장치**다. 이 함수 안에서는 Postgres 가
-- INSERT/UPDATE/DELETE 자체를 거부한다 — 읽기 경로가 초대를 소모하거나(EC-A01)
-- J-04 의 만료 처리(T-06)를 대신 수행하는 사고를 문법 수준에서 막는다.
stable
as $$
declare
  v_status public.invitation_status;
  v_lapsed boolean;
  v_payload jsonb;
begin
  -- 작성자는 promises.creator_id 로 찾는다. invitations.created_by 가 아니다 —
  -- §4-5-2 에서 증인 초대는 상대방도 보낼 수 있어서, created_by 로 조인하면
  -- 그 경우에만 엉뚱한 사람 이름이 나간다.
  --
  -- 제목은 promises 의 현재 버전 캐시에서 읽는다(§6-2). promise_versions 로
  -- 조인하면 안 된다 — current_version_id 는 확정(ACTIVE) 전에는 비어 있어서,
  -- 정작 이 함수가 존재하는 이유인 PENDING 초대가 전부 E_NOT_FOUND 가 된다.
  select i.status,
         i.expires_at <= now(),
         jsonb_build_object(
           'creator_nickname', u.nickname,
           'title',            p.title,
           'expires_at',       i.expires_at,
           'target_role',      i.target_role
         )
    into v_status, v_lapsed, v_payload
    from public.invitations i
    join public.promises p on p.id = i.promise_id
    join public.users u on u.id = p.creator_id
   where i.token_hash = p_token_hash;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- 저장된 status 가 시계보다 **먼저**다. 사용된 토큰이 만료 시각을 넘겼다고
  -- E_INVITE_EXPIRED 로 바뀌면, 참여자 본인을 약속 상세로 보내는 EC-B02 분기가
  -- 구분할 근거를 잃는다.
  if v_status = 'REVOKED' then
    raise exception 'E_INVITE_REVOKED';
  end if;

  if v_status = 'USED' then
    raise exception 'E_INVITE_USED';
  end if;

  -- status='EXPIRED' 는 J-04 가 남긴 기록이고, v_lapsed 는 아직 J-04 가 오지 않은 구간이다.
  -- J-04 는 30분마다 돌기 때문에(§7-2) 둘 다 보지 않으면 만료된 링크가 최대 30분 더 열린다.
  if v_status = 'EXPIRED' or v_lapsed then
    raise exception 'E_INVITE_EXPIRED';
  end if;

  return v_payload;
end;
$$;

comment on function public.lf_invite_resolve is
  '초대 토큰 조회 (02 §4-3-3). 로그인 전 최소 정보만 반환하고 본문·보상·벌칙은 절대 포함하지 않는다.';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

-- 이 함수는 비로그인 방문자를 위해 존재하지만, 방문자가 **직접** 부르는 것은 아니다.
-- 얇은 Edge Function 이 service_role 로 부른다. anon 에게 열면 토큰 대조 없이도
-- 초대 테이블을 두드릴 수 있는 표면이 생긴다.
--
-- `from public` 만으로는 닫히지 않는다 — Supabase 는 public 스키마에
-- `alter default privileges … grant all on functions to anon, authenticated` 를 걸어 둔다.
revoke all on function public.lf_invite_resolve(char(64)) from public, anon, authenticated;
grant execute on function public.lf_invite_resolve(char(64)) to service_role;
