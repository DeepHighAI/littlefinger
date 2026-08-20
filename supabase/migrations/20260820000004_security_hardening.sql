-- Supabase Security/Performance Advisor 하드닝. 세 축 모두 동작 변경이 아니라
-- 기본값이 열어 둔 표면을 닫는 것이다.
--
-- 1) search_path 미고정 함수 30개 — 같은 이름의 객체를 먼저 찾는 스키마에 심으면 함수
--    내부 참조가 바꿔치기된다(advisor: function_search_path_mutable). 이 저장소의 함수
--    본문은 전부 `public.` 정규화라(감사 2026-08-20) ALTER 만으로 안전하고, ALTER 는
--    ACL·정책 참조를 보존한다.
-- 2) RLS 의 bare auth.uid() — 행마다 재평가된다(advisor: auth_rls_initplan).
--    `(select auth.uid())` 는 init-plan 으로 쿼리당 한 번만 돈다. ALTER POLICY 는
--    이름·cmd·roles 를 보존하므로 표현식만 바뀐다.
-- 3) 정책이 부여하지 않는 동사의 grant 회수 — Supabase 기본 권한은 모든 표에 모든
--    동사를 준다. TRUNCATE 는 RLS 를 **거치지 않으므로** grant 가 남아 있으면 정책과
--    무관하게 표를 비울 수 있다. SELECT 는 permissive 정책이 있는 표(클라이언트
--    PostgREST 읽기: app_configs·promises·approvals 등)에만 남긴다.
--    이전 마이그레이션이 이미 회수한 동사(notifications SELECT, blocks·reports INSERT,
--    users UPDATE 등)는 되돌리지 않는다 — 회수는 단방향이다.

-- 1) search_path 고정 ------------------------------------------------------------

alter function public.lf_assert_actor(uuid) set search_path = '';
alter function public.lf_assert_promise_content(text, text, text, text, text, text)
  set search_path = '';
alter function public.lf_content_hash(
  text, text, public.promise_category, date, public.keeper, text, text, integer
) set search_path = '';
alter function public.lf_draft_max_concurrent() set search_path = '';
alter function public.lf_end_date_max_days() set search_path = '';
alter function public.lf_fingerprint(character, integer) set search_path = '';
alter function public.lf_idempotency_begin(uuid, uuid, text) set search_path = '';
alter function public.lf_idempotency_finish(uuid, jsonb) set search_path = '';
alter function public.lf_idempotency_ttl_minutes() set search_path = '';
alter function public.lf_invite_expire_soon_lead_hours() set search_path = '';
alter function public.lf_invite_issue_row(uuid, uuid, character) set search_path = '';
alter function public.lf_invite_lock_for_response(character, uuid) set search_path = '';
alter function public.lf_invite_preview(character, uuid) set search_path = '';
alter function public.lf_invite_resend_max() set search_path = '';
alter function public.lf_invite_resolve(character) set search_path = '';
alter function public.lf_invite_revoke(uuid, uuid, uuid) set search_path = '';
alter function public.lf_invite_ttl_hours() set search_path = '';
alter function public.lf_normalize_input(text) set search_path = '';
alter function public.lf_promise_amend_suggest(
  uuid, character, uuid, text, public.surface, character, character
) set search_path = '';
alter function public.lf_promise_approve(
  uuid, character, uuid, public.surface, character, character
) set search_path = '';
alter function public.lf_promise_create(
  uuid, uuid, text, text, text, text, text, text, text, boolean, character
) set search_path = '';
alter function public.lf_promise_create_draft(
  uuid, text, text, text, text, text, text, text, boolean
) set search_path = '';
alter function public.lf_promise_decline(
  uuid, character, uuid, text, public.surface, character, character
) set search_path = '';
alter function public.lf_promise_draft_update(
  uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, character
) set search_path = '';
alter function public.lf_promise_invite(uuid, uuid, uuid, character) set search_path = '';
alter function public.lf_promise_max_per_day() set search_path = '';
alter function public.lf_rate_limit_hit(text) set search_path = '';
alter function public.lf_rate_limit_max_hits() set search_path = '';
alter function public.lf_rate_limit_window_seconds() set search_path = '';
alter function public.lf_reminder_offsets_days() set search_path = '';

-- 2) RLS init-plan ---------------------------------------------------------------

alter policy "blocks insert own" on public.blocks
  with check (blocker_id = (select auth.uid()));
alter policy "blocks read own" on public.blocks
  using (blocker_id = (select auth.uid()));
alter policy "device tokens delete own" on public.device_tokens
  using (user_id = (select auth.uid()));
alter policy "device tokens insert own" on public.device_tokens
  with check (user_id = (select auth.uid()));
alter policy "device tokens read own" on public.device_tokens
  using (user_id = (select auth.uid()));
alter policy "device tokens update own" on public.device_tokens
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "invitations read creator" on public.invitations
  using (created_by = (select auth.uid()));
alter policy "notifications read own" on public.notifications
  using (user_id = (select auth.uid()));
alter policy "participants read own promises" on public.promise_participants
  using (user_id = (select auth.uid()) or public.is_promise_participant(promise_id));
alter policy "promises delete own draft" on public.promises
  using (creator_id = (select auth.uid()) and status = 'DRAFT'::public.promise_status);
alter policy "promises read participants" on public.promises
  using (creator_id = (select auth.uid()) or public.can_read_promise(id));
alter policy "reports insert own" on public.reports
  with check (reporter_id = (select auth.uid()));
alter policy "reports read own" on public.reports
  using (reporter_id = (select auth.uid()));
alter policy "terms read own" on public.terms_agreements
  using (user_id = (select auth.uid()));
alter policy "trust profile read own" on public.trust_profiles
  using (user_id = (select auth.uid()));
alter policy "users read own" on public.users
  using (id = (select auth.uid()));

-- 3) 정책 없는 동사 회수 -----------------------------------------------------------
-- 이미 없는 권한의 revoke 는 no-op 이라, 여기 목록은 "남아야 하는 것"의 여집합으로 읽는다.

-- 정책이 하나도 없는 표 — 클라이언트 역할은 접근 자체가 없다.
revoke all on table public.daily_metrics from anon, authenticated;
revoke all on table public.fulfillment_checks from anon, authenticated;
revoke all on table public.idempotency_keys from anon, authenticated;
revoke all on table public.rate_limit_counters from anon, authenticated;
revoke all on table public.reminder_schedules from anon, authenticated;
-- SELECT 정책은 남아 있으나 20260815000007 이 SELECT grant 를 이미 회수했다 — 나머지도 닫는다.
revoke all on table public.notifications from anon, authenticated;

-- SELECT 정책만 있는 표 — SELECT 만 남긴다.
revoke insert, update, delete, references, trigger, truncate
  on table public.amend_requests from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.app_configs from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.approvals from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.blocks from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.invitations from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.promise_participants from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.promise_versions from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.reports from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.terms_agreements from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.trust_profiles from anon, authenticated;
revoke insert, update, delete, references, trigger, truncate
  on table public.users from anon, authenticated;

-- SELECT + DELETE(own draft) 정책 — 그 둘만 남긴다.
revoke insert, update, references, trigger, truncate
  on table public.promises from anon, authenticated;

-- 네 동사 모두 정책이 있는 표 — RLS 밖 동사만 회수한다.
revoke references, trigger, truncate
  on table public.device_tokens from anon, authenticated;
