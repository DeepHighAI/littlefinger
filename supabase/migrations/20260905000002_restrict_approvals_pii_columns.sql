-- approvals 의 ip_hash · user_agent_hash 를 클라이언트 직접 읽기에서 제외한다.
--
-- RLS 는 행 단위라 열을 가리지 못한다. 정책("approvals read participants")은 참여자에게
-- 행 전체를 열어 주므로, 표 단위 SELECT 권한이 남아 있는 한 참여자는 select=* 하나로
-- 상대방과 증인의 IP/UA 해시를 읽는다. 서버 뷰(lf_promise_detail)는 두 열을 일부러 빼고
-- 있고 promise-detail.test.ts 가 그것을 고정해 두었는데, PostgREST 직행 경로만 그 통제를
-- 우회하고 있었다.
--
-- "해시라서 안전"이 성립하지 않는 이유: salt 가 고정이라 동치 비교가 되고, UA 는 공격자가
-- 자기 요청 헤더를 골라 자기 행의 해시를 되읽는 방식으로 평문까지 역산된다. 04 §12-8 이
-- 원본 저장을 금지한 데이터가 사실상 복원되는 셈이다.
--
-- anon 은 auth.uid() 가 null 이라 이 정책을 통과한 적이 없다 — 회수해도 동작 변화가 없다.
-- service_role 과 security definer RPC 는 이 grant 를 거치지 않으므로 영향이 없다.
revoke select on table public.approvals from anon, authenticated;

-- 남기는 열은 lf_promise_detail 이 이미 참여자에게 보여 주는 것과 같은 범위다.
-- PostgREST 는 filter·order 대상 열에도 권한을 요구하므로 유일한 직접 호출인
-- promise-editor-native.ts 의 loadAmendSuggestComment(comment / promise_id · action /
-- acted_at · id)가 그대로 동작한다.
grant select (
  id,
  promise_id,
  version_id,
  user_id,
  role,
  action,
  content_hash,
  comment,
  surface,
  acted_at
) on table public.approvals to authenticated;
