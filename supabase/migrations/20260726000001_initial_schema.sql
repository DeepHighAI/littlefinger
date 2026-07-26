-- 리틀핑거 초기 스키마 — 02_세부기능명세서 §6-2, §6-3.
--
-- 마이그레이션은 순번 파일로 **추가만** 한다. 기존 파일은 고치지 않는다(04 §7-1).
-- 열거값 문자열은 코드와 정확히 같다(02 §6-3) — packages/shared 가 정본이고
-- supabase/tests/schema.test.ts 가 둘을 대조한다.
--
-- 시각은 전부 UTC(timestamptz)로 저장한다. KST 변환은 표시·계산 쪽 몫이다(02 §2-2).

-- ============================================================
-- ENUM — 02 §6-3
-- ============================================================

create type public.promise_status as enum (
  'DRAFT', 'PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING',
  'COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED'
);

create type public.promise_category as enum ('HABIT', 'BET', 'MONEY', 'ETC');

-- 지킬 사람. 역할과는 별개 속성이다(02 §2-1).
create type public.keeper as enum ('CREATOR', 'PARTNER', 'BOTH');

create type public.participant_role as enum ('CREATOR', 'PARTNER', 'WITNESS');
create type public.participant_status as enum ('INVITED', 'JOINED', 'DECLINED', 'WITHDRAWN');

create type public.fulfillment_answer as enum ('KEPT', 'NOT_KEPT');
create type public.surface as enum ('APP', 'WEB');
create type public.invitation_status as enum ('PENDING', 'USED', 'EXPIRED', 'REVOKED');
create type public.amend_type as enum ('AMEND', 'CANCEL');
create type public.amend_status as enum ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');
create type public.user_status as enum ('ACTIVE', 'SUSPENDED', 'WITHDRAWN');

create type public.device_platform as enum ('ANDROID');

create type public.approval_action as enum (
  'APPROVE', 'DECLINE', 'AMEND_SUGGEST',
  'AMEND_REQUEST', 'AMEND_APPROVE', 'AMEND_DECLINE', 'AMEND_WITHDRAW',
  'CANCEL_REQUEST', 'CANCEL_APPROVE', 'CANCEL_DECLINE',
  'WITNESS_SIGN'
);

create type public.notification_channel as enum ('PUSH', 'EMAIL', 'INAPP');
create type public.notification_status as enum ('QUEUED', 'SENT', 'FAILED', 'READ');

create type public.reminder_kind as enum (
  'D7', 'D3', 'D1', 'DDAY',
  'CHECK_REQ', 'CHECK_R1', 'CHECK_R2',
  'AMEND_REMIND', 'INVITE_EXPIRE_SOON'
);
create type public.reminder_status as enum ('PENDING', 'SENT', 'CANCELED');

create type public.report_reason as enum ('ABUSE', 'SPAM', 'IMPERSONATION', 'WRONG_PARTNER', 'ETC');
create type public.report_status as enum ('RECEIVED', 'REVIEWING', 'ACTIONED', 'REJECTED');

-- ============================================================
-- users — 계정. 앱·웹 공통.
-- id 는 auth.users 를 그대로 따라간다. 그래야 RLS 에서 auth.uid() 로 바로 비교된다.
-- ============================================================

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 카카오 회원번호. 탈퇴 시 sha256(kakao_id + pepper) 로 대체한다(02 §6-5).
  kakao_id text not null unique,
  nickname varchar(40) not null,
  profile_image_url text,
  -- 이메일은 수집하지 않는다(PO 결정 2026-07-26). 컬럼은 남기되 채우지 않는다.
  email text,
  email_verified boolean not null default false,
  -- 2 이상이면 이메일 발송을 멈춘다(EC-G03).
  email_bounce_count int not null default 0,
  status public.user_status not null default 'ACTIVE',
  -- 최초 가입 표면. 앱 설치 전환 KPI 산출용.
  primary_surface public.surface not null,
  notification_pref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

-- ============================================================
-- device_tokens — 푸시 토큰. 사용자당 최대 DEVICE_TOKEN_MAX(3)행.
-- 상한은 애플리케이션이 지키고, 초과 시 last_seen_at 이 오래된 행을 지운다.
-- ============================================================

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  fcm_token text not null unique,
  platform public.device_platform not null default 'ANDROID',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id, last_seen_at desc);

-- ============================================================
-- promises — 약속 본체. 상태·메타 + 조회용 캐시.
-- 내용 원본은 promise_versions 이고 여기 내용 컬럼은 목록 조회·배치 스캔용 캐시다.
-- ============================================================

create table public.promises (
  id uuid primary key default gen_random_uuid(),
  -- 작성자는 변경 불가.
  creator_id uuid not null references public.users (id),
  status public.promise_status not null default 'DRAFT',
  -- 활성 버전. promise_versions 가 뒤에 생기므로 FK 는 파일 끝에서 건다.
  current_version_id uuid,

  -- 현재 버전 캐시 (원본은 promise_versions)
  title varchar(40),
  body text,
  category public.promise_category,
  end_date date,
  keeper public.keeper,
  reward varchar(100),
  penalty varchar(100),

  witness_enabled boolean not null default false,

  activated_at timestamptz,
  checking_started_at timestamptz,
  check_deadline_at timestamptz,
  check_round_no int not null default 1,
  closed_at timestamptz,
  hash_verified_at timestamptz,
  -- 낙관적 락. 상태 전이는 조건부 UPDATE 로만 한다(02 §7-3).
  lock_version int not null default 0,
  -- 목록에서 숨긴 사용자 id 배열. **삭제가 아니라 내 화면 숨김만**이다(S-5, EC-H03).
  hidden_by jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promises_status_end_date_idx on public.promises (status, end_date);
create index promises_creator_status_idx on public.promises (creator_id, status);
create index promises_status_deadline_idx on public.promises (status, check_deadline_at);

-- ============================================================
-- promise_versions — 내용 원본. append-only.
-- 예외는 확정 전 DRAFT 의 version 1 덮어쓰기뿐이고, 그건 서버가 처리한다.
-- ============================================================

create table public.promise_versions (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  version_no int not null,

  title varchar(40) not null,
  body text not null,
  category public.promise_category not null,
  end_date date not null,
  keeper public.keeper not null,
  reward varchar(100),
  penalty varchar(100),

  -- SHA-256 소문자 hex 64자. Edge Function 안에서만 만든다(04 §7-3).
  content_hash char(64) not null,
  created_by uuid not null references public.users (id),
  -- NULL 이면 아직 활성화되지 않은 제안본이다.
  activated_at timestamptz,
  superseded_at timestamptz,
  change_reason varchar(200),
  created_at timestamptz not null default now(),

  unique (promise_id, version_no)
);

alter table public.promises
  add constraint promises_current_version_fk
  foreign key (current_version_id) references public.promise_versions (id);

-- ============================================================
-- promise_participants — 역할. 같은 약속에서 한 사람이 두 역할을 가질 수 없다.
-- ============================================================

create table public.promise_participants (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  -- 증인 초대를 보내고 아직 수락 전이면 NULL 이다.
  user_id uuid references public.users (id),
  role public.participant_role not null,
  status public.participant_status not null default 'INVITED',
  invited_at timestamptz not null default now(),
  joined_at timestamptz
);

-- 중복 역할 차단 (EC-B05, EC-D02). user_id 가 NULL 인 행은 제약 대상이 아니다.
create unique index promise_participants_unique_user
  on public.promise_participants (promise_id, user_id)
  where user_id is not null;

-- 약속당 CREATOR 1행 · PARTNER 최대 1행. 증인 상한 2명은 트랜잭션 안에서 센다(02 §7-3).
create unique index promise_participants_single_creator
  on public.promise_participants (promise_id)
  where role = 'CREATOR';

create unique index promise_participants_single_partner
  on public.promise_participants (promise_id)
  where role = 'PARTNER';

create index promise_participants_user_idx on public.promise_participants (user_id, promise_id);

-- ============================================================
-- approvals — 감사 추적 로그. append-only, 삭제 불가. 계정 탈퇴에도 보존한다.
-- ============================================================

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id),
  version_id uuid references public.promise_versions (id),
  user_id uuid not null references public.users (id),
  role public.participant_role not null,
  action public.approval_action not null,
  -- 행위 당시의 내용 해시. 사후 대조용.
  content_hash char(64),
  comment varchar(300),
  surface public.surface not null,
  -- 원본 저장 금지. salt 해시만 남긴다(04 §12-8).
  ip_hash char(64),
  user_agent_hash char(64),
  acted_at timestamptz not null default now()
);

create index approvals_promise_idx on public.approvals (promise_id, acted_at);

-- ============================================================
-- invitations — 1회용 초대 링크. 토큰 원문은 어디에도 저장하지 않는다.
-- ============================================================

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  target_role public.participant_role not null,
  -- SHA-256(token + pepper). 원본 대조는 서버에서만 한다(04 §7-3).
  token_hash char(64) not null unique,
  created_by uuid not null references public.users (id),
  -- 발급 + INVITE_TTL_HOURS(72)
  expires_at timestamptz not null,
  status public.invitation_status not null default 'PENDING',
  used_by uuid references public.users (id),
  used_at timestamptz,
  -- 남용 방지. INVITE_RESEND_MAX(10) 까지.
  resend_count int not null default 0,
  parent_invitation_id uuid references public.invitations (id),
  created_at timestamptz not null default now(),

  constraint invitations_target_role_check check (target_role in ('PARTNER', 'WITNESS'))
);

create index invitations_promise_status_idx on public.invitations (promise_id, status);
create index invitations_status_expires_idx on public.invitations (status, expires_at);

-- ============================================================
-- fulfillment_checks — 이행 확인 응답.
-- 같은 라운드에 한 사람이 두 번 응답할 수 없다. 정정은 같은 행 1회 갱신만 허용(§4-7-2).
-- ============================================================

create table public.fulfillment_checks (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  -- 어느 버전을 놓고 판단했는지 남긴다.
  version_id uuid not null references public.promise_versions (id),
  user_id uuid not null references public.users (id),
  round_no int not null default 1,
  answer public.fulfillment_answer not null,
  comment varchar(200),
  surface public.surface not null,
  submitted_at timestamptz not null default now(),
  -- 1회 정정이 일어난 시각. NULL 이면 아직 정정하지 않았다.
  revised_at timestamptz,

  -- 동시 제출 경합을 DB 레벨에서 막는다(02 §7-3).
  unique (promise_id, user_id, round_no)
);

-- ============================================================
-- fulfillment_evidences — 증빙 이미지.
-- 비공개 버킷 키만 저장한다. 공개 URL 을 저장하면 서명 URL 체계가 무의미해진다.
-- ============================================================

create table public.fulfillment_evidences (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.fulfillment_checks (id) on delete cascade,
  promise_id uuid not null references public.promises (id) on delete cascade,
  uploaded_by uuid not null references public.users (id),
  storage_key text not null,
  thumb_key text,
  mime text not null,
  bytes int not null,
  width int,
  height int,
  -- 신고로 블라인드 처리된 시각.
  blinded_at timestamptz,
  -- 종결 + EVIDENCE_RETENTION_DAYS(365). J-08 이 이 날짜로 지운다.
  purge_after date,
  created_at timestamptz not null default now()
);

create index fulfillment_evidences_purge_idx on public.fulfillment_evidences (purge_after);

-- ============================================================
-- amend_requests — 변경·파기 요청. 약속당 PENDING 은 최대 1건.
-- ============================================================

create table public.amend_requests (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  requester_id uuid not null references public.users (id),
  type public.amend_type not null,
  -- 파기면 NULL, 변경이면 아직 활성화되지 않은 제안 버전.
  proposed_version_id uuid references public.promise_versions (id),
  reason varchar(200),
  status public.amend_status not null default 'PENDING',
  -- 생성 + AMEND_AUTO_WITHDRAW_DAYS(7). J-05 가 만료시킨다.
  expires_at timestamptz not null,
  responded_by uuid references public.users (id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

-- 중복 요청을 DB 레벨에서 막는다(02 §7-3).
create unique index amend_requests_single_pending
  on public.amend_requests (promise_id)
  where status = 'PENDING';

-- ============================================================
-- notifications — 발송 이력 + 인앱 알림함. append-only.
-- 읽음 처리는 서버가 service_role 로 한다 — 클라이언트에 UPDATE 를 열지 않는다.
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  promise_id uuid references public.promises (id) on delete cascade,
  type text not null,
  channel public.notification_channel not null,
  title text not null,
  body text not null,
  deeplink text,
  status public.notification_status not null default 'QUEUED',
  fail_reason text,
  -- 배치를 두 번 돌려도 중복 발송되지 않게 하는 열쇠(04 §7-4).
  dedupe_key text not null unique,
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ============================================================
-- reminder_schedules — 예약 발송 큐. KST 기준 시각을 UTC 로 변환해 넣는다.
-- ============================================================

create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  kind public.reminder_kind not null,
  fire_at timestamptz not null,
  status public.reminder_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

create index reminder_schedules_due_idx on public.reminder_schedules (status, fire_at);

-- ============================================================
-- trust_profiles — 약속 지킴율 집계 캐시(§4-9-1).
-- keep_rate 가 NULL 이면 표본 부족이라 화면에 "집계 중"으로 나간다.
-- ============================================================

create table public.trust_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  completed_count int not null default 0,
  broken_count int not null default 0,
  disputed_count int not null default 0,
  unresolved_count int not null default 0,
  active_count int not null default 0,
  keep_rate int,
  updated_at timestamptz not null default now(),

  constraint trust_profiles_keep_rate_range check (keep_rate is null or (keep_rate between 0 and 100))
);

-- ============================================================
-- 보조 테이블
-- ============================================================

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (blocker_id, blocked_user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id),
  target_user_id uuid references public.users (id),
  promise_id uuid references public.promises (id),
  evidence_id uuid references public.fulfillment_evidences (id),
  reason public.report_reason not null,
  detail text,
  status public.report_status not null default 'RECEIVED',
  created_at timestamptz not null default now()
);

create table public.terms_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  agreed_at timestamptz not null default now()
);

-- KST 기준 날짜로 집계한다.
create table public.daily_metrics (
  date date primary key,
  activated_count int not null default 0,
  invite_sent_count int not null default 0,
  invite_accepted_count int not null default 0,
  completed_count int not null default 0,
  web_to_app_install_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- §11-3 설정값의 원격 제어 지점. ads_enabled 는 여기가 정본이다.
create table public.app_configs (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
