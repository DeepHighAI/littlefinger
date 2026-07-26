-- RLS — 02_세부기능명세서 §9 권한 매트릭스, 04 §7-2.
--
-- 세 가지 원칙이 이 파일 전체를 지배한다.
--
-- 1. **비참여자에게는 약속의 존재 자체를 알리지 않는다.** 권한 없는 조회는 "권한 없음"이 아니라
--    빈 결과가 되고, 애플리케이션이 E_NOT_FOUND 로 답한다. 그래서 SELECT 정책이
--    "권한 없으면 거부"가 아니라 "참여자인 행만 보인다"로 짜여 있다.
-- 2. **확정 후 불변.** ACTIVE 이후 내용 필드는 UPDATE 가 정책으로 거부된다.
--    변경은 promise_versions 새 행으로만 표현한다.
-- 3. **append-only 테이블에는 UPDATE/DELETE 정책을 아예 만들지 않는다.**
--    정책이 없으면 RLS 아래에서는 아무도 못 한다 — service_role 만 예외다.
--
-- 상태 전이·해시 생성·토큰 대조는 전부 Edge Function(service_role)이 한다.
-- service_role 은 RLS 를 우회하므로, 여기 정책은 **클라이언트가 직접 할 수 있는 일**만 연다.
-- 그래서 대부분의 테이블이 SELECT 만 열려 있다.

-- ============================================================
-- 헬퍼 — 정책이 서로를 재귀 호출하지 않도록 security definer 로 RLS 를 우회한다.
-- ============================================================

create or replace function public.is_promise_participant(p_promise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.promise_participants pp
    where pp.promise_id = p_promise_id
      and pp.user_id = auth.uid()
      and pp.status in ('INVITED', 'JOINED')
  );
$$;

-- 증인은 ACTIVE 이후에만 전문을 볼 수 있다(§9).
create or replace function public.can_read_promise(p_promise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.promise_participants pp
    join public.promises p on p.id = pp.promise_id
    where pp.promise_id = p_promise_id
      and pp.user_id = auth.uid()
      and pp.status in ('INVITED', 'JOINED')
      and (
        pp.role in ('CREATOR', 'PARTNER')
        or p.status not in ('DRAFT', 'PENDING')
      )
  );
$$;

-- ============================================================
-- RLS 활성화 — 모든 테이블에 켠다(04 §7-2).
-- ============================================================

alter table public.users enable row level security;
alter table public.device_tokens enable row level security;
alter table public.promises enable row level security;
alter table public.promise_versions enable row level security;
alter table public.promise_participants enable row level security;
alter table public.approvals enable row level security;
alter table public.invitations enable row level security;
alter table public.fulfillment_checks enable row level security;
alter table public.fulfillment_evidences enable row level security;
alter table public.amend_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_schedules enable row level security;
alter table public.trust_profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.terms_agreements enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.app_configs enable row level security;

-- ============================================================
-- users — 자기 행만 보고 고친다. 남의 프로필은 참여한 약속을 통해서만 보인다.
-- ============================================================

create policy "users read own" on public.users
  for select using (id = auth.uid());

create policy "users update own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- device_tokens — 자기 기기만. 로그아웃 시 지우는 건 기록 삭제가 아니다.
-- ============================================================

create policy "device tokens read own" on public.device_tokens
  for select using (user_id = auth.uid());

create policy "device tokens insert own" on public.device_tokens
  for insert with check (user_id = auth.uid());

create policy "device tokens update own" on public.device_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "device tokens delete own" on public.device_tokens
  for delete using (user_id = auth.uid());

-- ============================================================
-- promises
--
-- 읽기: 참여자만. 비참여자에게는 행이 아예 없는 것처럼 보인다.
-- 쓰기: DRAFT 일 때 작성자만. 그 밖의 모든 전이는 Edge Function 이 한다.
-- ============================================================

create policy "promises read participants" on public.promises
  for select using (public.can_read_promise(id));

create policy "promises insert own draft" on public.promises
  for insert with check (creator_id = auth.uid() and status = 'DRAFT');

-- ACTIVE 이후 내용 변경은 여기서 막힌다(원칙 P3). 변경은 promise_versions 추가로만 표현한다.
create policy "promises update own draft" on public.promises
  for update
  using (creator_id = auth.uid() and status = 'DRAFT')
  with check (creator_id = auth.uid() and status = 'DRAFT');

-- 확정된 약속은 지울 수 없다. 상대방의 기록이기도 하기 때문이다(§9 기록 삭제 ❌).
create policy "promises delete own draft" on public.promises
  for delete using (creator_id = auth.uid() and status = 'DRAFT');

-- ============================================================
-- promise_versions — append-only. UPDATE/DELETE 정책을 만들지 않는다.
-- DRAFT 단계의 초안 작성만 클라이언트에 연다.
-- ============================================================

create policy "promise versions read participants" on public.promise_versions
  for select using (public.can_read_promise(promise_id));

create policy "promise versions insert own draft" on public.promise_versions
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.promises p
      where p.id = promise_id and p.creator_id = auth.uid() and p.status = 'DRAFT'
    )
  );

-- ============================================================
-- promise_participants — 읽기만. 역할 부여는 Edge Function 이 한다.
-- ============================================================

create policy "participants read own promises" on public.promise_participants
  for select using (user_id = auth.uid() or public.is_promise_participant(promise_id));

-- ============================================================
-- approvals — 감사 로그. append-only, 삭제 불가. 기록은 Edge Function 만 쓴다.
-- ============================================================

create policy "approvals read participants" on public.approvals
  for select using (public.can_read_promise(promise_id));

-- ============================================================
-- invitations — 작성자만 자기가 보낸 초대를 본다.
-- 토큰 대조는 invite-resolve Edge Function 이 하므로 수락자에게는 열지 않는다.
-- ============================================================

create policy "invitations read creator" on public.invitations
  for select using (created_by = auth.uid());

-- ============================================================
-- fulfillment_checks — append-only. 제출과 1회 정정은 fulfillment-submit 이 한다.
-- 양측 응답을 비교해 종결 상태를 정하는 판정도 서버 몫이다(J-01).
-- ============================================================

create policy "fulfillment checks read participants" on public.fulfillment_checks
  for select using (public.can_read_promise(promise_id));

-- ============================================================
-- fulfillment_evidences — 증인 포함 참여자가 읽는다(§9 증빙 열람 ✅).
-- 실제 이미지는 비공개 버킷에 있고 10분 서명 URL 로만 나간다.
-- ============================================================

create policy "evidences read participants" on public.fulfillment_evidences
  for select using (public.is_promise_participant(promise_id));

-- ============================================================
-- amend_requests — 읽기만. 요청·승인·거절은 전부 Edge Function 이 한다.
-- ============================================================

create policy "amend requests read participants" on public.amend_requests
  for select using (public.can_read_promise(promise_id));

-- ============================================================
-- notifications — append-only. 읽음 처리도 서버가 한다(04 §7-2).
-- ============================================================

create policy "notifications read own" on public.notifications
  for select using (user_id = auth.uid());

-- ============================================================
-- trust_profiles — 자기 것만. 상대방 지킴율은 MVP 에서 노출하지 않는다(S-12).
-- ============================================================

create policy "trust profile read own" on public.trust_profiles
  for select using (user_id = auth.uid());

-- ============================================================
-- blocks · reports · terms_agreements — 본인 행만.
-- 차단 해제는 §9 에 없다. 필요해지면 Edge Function 으로 연다 — 임의로 열지 않는다.
-- ============================================================

create policy "blocks read own" on public.blocks
  for select using (blocker_id = auth.uid());

create policy "blocks insert own" on public.blocks
  for insert with check (blocker_id = auth.uid());

create policy "reports read own" on public.reports
  for select using (reporter_id = auth.uid());

create policy "reports insert own" on public.reports
  for insert with check (reporter_id = auth.uid());

create policy "terms read own" on public.terms_agreements
  for select using (user_id = auth.uid());

create policy "terms insert own" on public.terms_agreements
  for insert with check (user_id = auth.uid());

-- ============================================================
-- app_configs — 클라이언트가 ads_enabled 등을 읽어야 한다. 쓰기는 운영자만.
-- ============================================================

create policy "app configs read all" on public.app_configs
  for select using (true);

-- ============================================================
-- 서버 전용 테이블 — 정책을 만들지 않는다. service_role 만 접근한다.
--
-- server-only: reminder_schedules  발송 큐. 클라이언트가 볼 이유가 없다.
-- server-only: daily_metrics       운영 지표. 사용자에게 노출하지 않는다.
-- ============================================================
