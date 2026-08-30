-- Rewarded ads, per-user retention and the per-promise permanent-access product.
-- PO confirmed 2026-08-29. All mutable grants enter through server-only RPCs.

alter type public.amend_type add value if not exists 'FINISH';
alter type public.approval_action add value if not exists 'FINISH_REQUEST';
alter type public.approval_action add value if not exists 'FINISH_APPROVE';
alter type public.approval_action add value if not exists 'FINISH_DECLINE';
alter type public.approval_action add value if not exists 'FINISH_WITHDRAW';
alter type public.reminder_kind add value if not exists 'RETENTION_D7';
alter type public.reminder_kind add value if not exists 'RETENTION_D1';

alter table public.promise_versions alter column end_date drop not null;
alter table public.promise_participants add column invited_by_user_id uuid references public.users (id);
alter table public.promises
  add column retention_anchor_at timestamptz,
  add column purge_state text not null default 'AVAILABLE'
    check (purge_state in ('AVAILABLE', 'PURGING'));

alter table public.slot_purchases add column promise_id uuid;
alter table public.slot_purchases
  add constraint slot_purchases_promise_fk foreign key (promise_id)
  references public.promises (id) on delete set null;
alter table public.slot_purchases drop constraint slot_purchases_granted_slots_check;
-- 영구보존 원장은 promise_id 를 강제하지 않는다. FK 가 on delete set null 이라 DRAFT 삭제나
-- 정리(purge)가 지나간 뒤에도 구매 원장은 promise_id 가 비워진 채 남아야 하고, 여기서
-- not null 을 요구하면 그 삭제가 제약 위반으로 막힌다.
alter table public.slot_purchases add constraint slot_purchases_scope_check check (
  (product_id = 'promise_slot_plus1' and promise_id is null and granted_slots > 0)
  or (product_id = 'promise_permanent_access' and granted_slots = 0)
);

create or replace function public.lf_witness_max()
returns int language sql immutable set search_path = '' as $$ select 3 $$;
create or replace function public.lf_witness_creator_free()
returns int language sql immutable set search_path = '' as $$ select 1 $$;
create or replace function public.lf_end_date_free_days()
returns int language sql immutable set search_path = '' as $$ select 30 $$;
create or replace function public.lf_extension_days()
returns int language sql immutable set search_path = '' as $$ select 30 $$;
create or replace function public.lf_retention_free_days()
returns int language sql immutable set search_path = '' as $$ select 30 $$;
create or replace function public.lf_reward_intent_ttl_minutes()
returns int language sql immutable set search_path = '' as $$ select 15 $$;
-- packages/shared RETENTION_WARNING_DAYS 의 쌍둥이 — [D-7, D-1] 경고 창의 정본. SQL 은 shared 를
-- import 할 수 없으므로 monetization-retention.test.ts 가 두 값을 대조한다.
create or replace function public.lf_retention_warning_days()
returns int[] language sql immutable set search_path = '' as $$ select '{7,1}'::int[] $$;
create or replace function public.lf_permanent_access_product_id()
returns text language sql immutable set search_path = '' as $$ select 'promise_permanent_access'::text $$;
create or replace function public.lf_end_date_max_days()
returns int language sql immutable set search_path = '' as $$ select 36500 $$;

insert into public.app_configs (key, value)
values ('rewarded_ads_enabled', 'true'::jsonb)
on conflict (key) do update set value = excluded.value;

-- server-only: promise_duration_baselines
create table public.promise_duration_baselines (
  promise_id uuid primary key references public.promises (id) on delete cascade,
  ceiling_date date not null,
  created_at timestamptz not null default now()
);

-- server-only: reward_intents
create table public.reward_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  promise_id uuid not null references public.promises (id) on delete cascade,
  action text not null check (action in (
    'WITNESS_CREATOR', 'WITNESS_PARTNER', 'DURATION_30D', 'RETENTION_30D'
  )),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'GRANTED', 'REJECTED')),
  opaque_user_id text not null,
  expires_at timestamptz not null,
  transaction_id text unique,
  ad_unit_id text,
  rewarded_at timestamptz,
  granted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reward_intents_one_pending_idx
  on public.reward_intents (user_id, promise_id, action) where status = 'PENDING';
create index reward_intents_promise_idx on public.reward_intents (promise_id);
create index reward_intents_user_idx on public.reward_intents (user_id);

-- server-only: promise_reward_grants
create table public.promise_reward_grants (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  user_id uuid not null references public.users (id),
  action text not null check (action in (
    'WITNESS_CREATOR', 'WITNESS_PARTNER', 'DURATION_30D', 'RETENTION_30D'
  )),
  source text not null check (source in ('ADMOB_SSV', 'MIGRATION')),
  intent_id uuid references public.reward_intents (id),
  created_at timestamptz not null default now()
);
create unique index promise_reward_grants_intent_idx
  on public.promise_reward_grants (intent_id) where intent_id is not null;
create index promise_reward_grants_lookup_idx
  on public.promise_reward_grants (promise_id, user_id, action);

-- server-only: promise_access_graces
create table public.promise_access_graces (
  promise_id uuid not null references public.promises (id) on delete cascade,
  user_id uuid not null references public.users (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (promise_id, user_id)
);
create index promise_access_graces_user_idx on public.promise_access_graces (user_id);

-- server-only: user_keep_rate_aggregates
create table public.user_keep_rate_aggregates (
  user_id uuid primary key references public.users (id),
  completed_count int not null default 0 check (completed_count >= 0),
  broken_count int not null default 0 check (broken_count >= 0),
  disputed_count int not null default 0 check (disputed_count >= 0),
  unresolved_count int not null default 0 check (unresolved_count >= 0),
  updated_at timestamptz not null default now()
);

-- server-only: purged_promise_receipts
create table public.purged_promise_receipts (
  promise_digest char(64) primary key,
  purged_at timestamptz not null
);

-- server-only: promise_purge_jobs
create table public.promise_purge_jobs (
  promise_id uuid primary key references public.promises (id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'LEASED')),
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'LEASED') = (lease_id is not null and lease_expires_at is not null))
);
create index promise_purge_jobs_pending_idx
  on public.promise_purge_jobs (created_at) where status = 'PENDING';
create index promise_purge_jobs_leased_idx
  on public.promise_purge_jobs (lease_expires_at, created_at) where status = 'LEASED';

create index promise_participants_inviter_idx
  on public.promise_participants (invited_by_user_id)
  where invited_by_user_id is not null;
create index slot_purchases_permanent_access_idx
  on public.slot_purchases (promise_id, user_id)
  where product_id = 'promise_permanent_access';

alter table public.promise_duration_baselines enable row level security;
alter table public.reward_intents enable row level security;
alter table public.promise_reward_grants enable row level security;
alter table public.promise_access_graces enable row level security;
alter table public.user_keep_rate_aggregates enable row level security;
alter table public.purged_promise_receipts enable row level security;
alter table public.promise_purge_jobs enable row level security;
revoke all on table public.promise_duration_baselines, public.reward_intents,
  public.promise_reward_grants, public.promise_access_graces,
  public.user_keep_rate_aggregates, public.purged_promise_receipts,
  public.promise_purge_jobs from public, anon, authenticated, service_role;

create or replace function public.lf_rewarded_ads_enabled()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
    (select case
       when ac.value = 'true'::jsonb then true
       when ac.value = 'false'::jsonb then false
       else null
     end from public.app_configs ac where ac.key = 'rewarded_ads_enabled'),
    true
  );
$$;

create or replace function public.lf_permanent_access_effective(
  p_promise_id uuid,
  p_user_id uuid
)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.slot_purchases sp
     where sp.promise_id = p_promise_id
       and sp.user_id = p_user_id
       and sp.product_id = public.lf_permanent_access_product_id()
       and not exists (
         select 1 from public.slot_purchase_revocations spr where spr.purchase_id = sp.id
       )
  );
$$;

create or replace function public.lf_reward_grant_count(
  p_promise_id uuid,
  p_user_id uuid,
  p_action text
)
returns int language sql stable set search_path = '' as $$
  select count(*)::int from public.promise_reward_grants prg
   where prg.promise_id = p_promise_id
     and prg.user_id = p_user_id
     and prg.action = p_action;
$$;

create or replace function public.lf_retention_anchor_of(p_promise_id uuid)
returns timestamptz language sql stable set search_path = '' as $$
  select case
    when p.activated_at is null then null
    when p.end_date is not null then
      ((p.end_date + 1)::timestamp at time zone 'Asia/Seoul')
    else p.retention_anchor_at
  end
  from public.promises p where p.id = p_promise_id;
$$;

create or replace function public.lf_access_expires_at(
  p_promise_id uuid,
  p_user_id uuid
)
returns timestamptz language sql stable set search_path = '' as $$
  select case
    when public.lf_permanent_access_effective(p_promise_id, p_user_id) then null
    when public.lf_retention_anchor_of(p_promise_id) is null then null
    -- 유예(grace)는 무료 구간과만 겨루고 보상 연장은 그 위에 얹는다. 연장까지 greatest 안에
    -- 넣으면 유예가 더 긴 기존 기록에서는 광고를 봐도 만료가 한 치도 안 움직인다.
    else greatest(
      public.lf_retention_anchor_of(p_promise_id)
        + pg_catalog.make_interval(days => public.lf_retention_free_days()),
      coalesce(
        (select pag.expires_at from public.promise_access_graces pag
          where pag.promise_id = p_promise_id and pag.user_id = p_user_id),
        '-infinity'::timestamptz
      )
    ) + pg_catalog.make_interval(days => public.lf_extension_days()
          * public.lf_reward_grant_count(p_promise_id, p_user_id, 'RETENTION_30D'))
  end;
$$;

create or replace function public.lf_has_record_access(
  p_user_id uuid,
  p_promise_id uuid,
  p_at timestamptz default now()
)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_promise public.promises%rowtype;
  v_role public.participant_role;
  v_participant_status public.participant_status;
  v_expiry timestamptz;
  v_unformed_expiry timestamptz;
begin
  select * into v_promise from public.promises p where p.id = p_promise_id;
  if not found or v_promise.purge_state <> 'AVAILABLE' then return false; end if;

  select pp.role, pp.status into v_role, v_participant_status
    from public.promise_participants pp
     where pp.promise_id = p_promise_id and pp.user_id = p_user_id
     limit 1;

  if v_promise.status = 'DRAFT' then
    return v_promise.creator_id = p_user_id
      or (v_role in ('CREATOR','PARTNER') and v_participant_status = 'JOINED');
  end if;
  if v_role is null then return false; end if;

  if v_promise.activated_at is null then
    if v_promise.status = 'PENDING' then
      if v_participant_status <> 'JOINED' or v_role = 'WITNESS' then return false; end if;
      select max(i.expires_at) + interval '30 days' into v_unformed_expiry
        from public.invitations i where i.promise_id = p_promise_id;
      return v_unformed_expiry is null or v_unformed_expiry > p_at;
    end if;
    if v_promise.status in ('DECLINED', 'CANCELED') then
      if v_participant_status not in ('JOINED', 'DECLINED') then return false; end if;
      return v_promise.closed_at is null or v_promise.closed_at + interval '30 days' > p_at;
    end if;
    return v_participant_status = 'JOINED';
  end if;

  if v_participant_status <> 'JOINED' then return false; end if;
  if public.lf_permanent_access_effective(p_promise_id, p_user_id) then return true; end if;
  v_expiry := public.lf_access_expires_at(p_promise_id, p_user_id);
  return v_expiry is null or v_expiry > p_at;
end;
$$;

create or replace function public.can_read_promise(p_promise_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.lf_has_record_access((select auth.uid()), p_promise_id, now());
$$;

create or replace function public.lf_duration_ceiling_date(p_promise_id uuid)
returns date language sql stable set search_path = '' as $$
  select case
    when public.lf_permanent_access_effective(p_promise_id, p.creator_id) then null
    else pdb.ceiling_date + public.lf_extension_days() * public.lf_reward_grant_count(
      p_promise_id, p.creator_id, 'DURATION_30D'
    )
  end
  from public.promises p
  join public.promise_duration_baselines pdb on pdb.promise_id = p.id
  where p.id = p_promise_id;
$$;

-- 초대자 기준 증인 사용량. JOINED 이거나 아직 유효한(PENDING·미만료) 초대가 걸린 INVITED 만
-- 센다. 만료된 초대 자리를 사용량에 넣으면 상대가 링크를 안 열었을 뿐인데 슬롯이 영영 잠긴다.
-- 현황(lf_promise_entitlements)과 발급 가드(lf_witness_invite)가 같은 수를 보게 하는 단일 정본이다.
create or replace function public.lf_witness_used(p_promise_id uuid, p_inviter uuid)
returns int language sql stable set search_path = '' as $$
  select count(*)::int from public.promise_participants pp
    left join public.invitations i on i.id = pp.invitation_id
   where pp.promise_id = p_promise_id and pp.role = 'WITNESS'
     and pp.invited_by_user_id = p_inviter
     and (pp.status = 'JOINED' or (pp.status = 'INVITED' and pp.user_id is null
       and i.status = 'PENDING' and i.expires_at > now()));
$$;

create or replace function public.lf_promise_entitlements(
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.participant_role;
  v_promise public.promises%rowtype;
  v_creator_capacity int;
  v_partner_capacity int;
  v_creator_used int;
  v_partner_used int;
  v_partner_id uuid;
  v_anchor timestamptz;
  v_expiry timestamptz;
  v_permanent boolean;
  v_duration_unlimited boolean;
begin
  perform public.lf_assert_actor(p_actor);
  select * into v_promise from public.promises p where p.id = p_promise_id;
  if not found then raise exception 'E_NOT_FOUND'; end if;

  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.user_id = p_actor and pp.status = 'JOINED';
  if v_role is null or not public.lf_has_record_access(p_actor, p_promise_id, now()) then
    raise exception 'E_NOT_FOUND';
  end if;

  v_creator_capacity := public.lf_witness_creator_free() + least(1,
    public.lf_reward_grant_count(p_promise_id, v_promise.creator_id, 'WITNESS_CREATOR'));
  v_partner_capacity := least(1, coalesce((select sum(
    public.lf_reward_grant_count(p_promise_id, pp.user_id, 'WITNESS_PARTNER'))
    from public.promise_participants pp where pp.promise_id = p_promise_id
      and pp.role = 'PARTNER' and pp.status = 'JOINED'), 0));
  select pp.user_id into v_partner_id from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.role = 'PARTNER' and pp.status = 'JOINED';
  v_creator_used := public.lf_witness_used(p_promise_id, v_promise.creator_id);
  v_partner_used := case when v_partner_id is null then 0
    else public.lf_witness_used(p_promise_id, v_partner_id) end;

  v_anchor := public.lf_retention_anchor_of(p_promise_id);
  v_expiry := public.lf_access_expires_at(p_promise_id, p_actor);
  v_permanent := public.lf_permanent_access_effective(p_promise_id, p_actor);
  v_duration_unlimited := public.lf_permanent_access_effective(
    p_promise_id, v_promise.creator_id
  );

  return pg_catalog.jsonb_build_object(
    'promise_id', p_promise_id,
    'my_role', v_role,
    'witness', pg_catalog.jsonb_build_object(
      'creator_capacity', v_creator_capacity,
      'partner_capacity', v_partner_capacity,
      'creator_used', coalesce(v_creator_used, 0),
      'partner_used', coalesce(v_partner_used, 0),
      'max', public.lf_witness_max()
    ),
    'duration', pg_catalog.jsonb_build_object(
      'ceiling_date', public.lf_duration_ceiling_date(p_promise_id),
      'unlimited', v_duration_unlimited
    ),
    'retention', pg_catalog.jsonb_build_object(
      'anchor_at', v_anchor,
      'expires_at', v_expiry,
      'permanent', v_permanent,
      'renewable', v_anchor is not null and not v_permanent
        and public.lf_has_record_access(p_actor, p_promise_id, now())
    )
  );
end;
$$;

create or replace function public.lf_duration_baseline_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.promise_duration_baselines (promise_id, ceiling_date)
  values (
    new.id,
    (new.created_at at time zone 'Asia/Seoul')::date + public.lf_end_date_free_days()
  ) on conflict (promise_id) do nothing;
  return new;
end;
$$;
create trigger promises_duration_baseline_insert
after insert on public.promises for each row execute function public.lf_duration_baseline_insert();
revoke all on function public.lf_duration_baseline_insert() from public, anon, authenticated;
grant execute on function public.lf_duration_baseline_insert() to service_role;

insert into public.promise_duration_baselines (promise_id, ceiling_date)
select p.id, greatest(
  (p.created_at at time zone 'Asia/Seoul')::date + public.lf_end_date_free_days(),
  coalesce(p.end_date, (p.created_at at time zone 'Asia/Seoul')::date)
)
from public.promises p on conflict (promise_id) do nothing;

create or replace function public.lf_assert_duration_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_ceiling date;
begin
  if old.status = 'DRAFT' and new.status = 'PENDING' then
    v_ceiling := public.lf_duration_ceiling_date(new.id);
    if (new.end_date is null and v_ceiling is not null)
       or (new.end_date is not null and v_ceiling is not null and new.end_date > v_ceiling) then
      raise exception 'E_END_DATE_RANGE';
    end if;
  end if;
  return new;
end;
$$;
create trigger promises_assert_duration_entitlement
before update of status on public.promises
for each row execute function public.lf_assert_duration_entitlement();
revoke all on function public.lf_assert_duration_entitlement() from public, anon, authenticated;
grant execute on function public.lf_assert_duration_entitlement() to service_role;

create or replace function public.lf_assert_amend_duration_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_end_date date; v_current_end_date date; v_ceiling date;
begin
  if new.type <> 'AMEND' then return new; end if;
  select pv.end_date into v_end_date from public.promise_versions pv where pv.id = new.proposed_version_id;
  -- 종료일을 그대로 둔 변경은 상한을 다시 묻지 않는다. 작성자의 영구보존이 환불되면 상한이
  -- 되살아나는데, 상대가 이미 승인한 '종료일 없음'은 되돌리지 않는 것이 명세(§환불)라 그 뒤의
  -- 제목·본문 변경까지 E_END_DATE_RANGE 로 막히면 약속이 영원히 못 고치는 상태가 된다.
  select p.end_date into v_current_end_date from public.promises p where p.id = new.promise_id;
  if v_end_date is not distinct from v_current_end_date then return new; end if;
  v_ceiling := public.lf_duration_ceiling_date(new.promise_id);
  if (v_end_date is null and v_ceiling is not null)
     or (v_end_date is not null and v_ceiling is not null and v_end_date > v_ceiling) then
    raise exception 'E_END_DATE_RANGE';
  end if;
  return new;
end;
$$;
create trigger amend_requests_assert_duration_entitlement
before insert on public.amend_requests
for each row execute function public.lf_assert_amend_duration_entitlement();
revoke all on function public.lf_assert_amend_duration_entitlement() from public, anon, authenticated;
grant execute on function public.lf_assert_amend_duration_entitlement() to service_role;

update public.promise_participants pp set invited_by_user_id = i.created_by
from public.invitations i where i.id = pp.invitation_id and pp.role = 'WITNESS';
update public.promise_participants pp set invited_by_user_id = p.creator_id
from public.promises p where p.id = pp.promise_id and pp.role = 'WITNESS'
  and pp.invited_by_user_id is null;

insert into public.promise_reward_grants (promise_id, user_id, action, source)
select pp.promise_id, p.creator_id, 'WITNESS_CREATOR', 'MIGRATION'
from public.promise_participants pp join public.promises p on p.id = pp.promise_id
where pp.role = 'WITNESS' and pp.status in ('INVITED', 'JOINED')
  and pp.invited_by_user_id = p.creator_id
group by pp.promise_id, p.creator_id having count(*) > 1;
insert into public.promise_reward_grants (promise_id, user_id, action, source)
select pp.promise_id, pp.invited_by_user_id, 'WITNESS_PARTNER', 'MIGRATION'
from public.promise_participants pp join public.promises p on p.id = pp.promise_id
where pp.role = 'WITNESS' and pp.status in ('INVITED', 'JOINED')
  and pp.invited_by_user_id is not null and pp.invited_by_user_id <> p.creator_id
group by pp.promise_id, pp.invited_by_user_id;

-- 배포 절벽 방지. 이미 만료된 기록만 유예하면 배포 다음 날부터 매일 한 무더기씩 예고 없이
-- 사라진다(D-7·D-1 경고를 받은 적이 없는 기록들). 성립한 모든 기록의 참여자에게 배포 시각
-- 기준 무료 구간 하나를 유예로 준다 — lf_access_expires_at 이 greatest 로 고르므로 만료가 더
-- 먼 기록에는 아무 영향이 없고, 가까운 기록은 최소 30일의 경고 기간을 얻는다.
insert into public.promise_access_graces (promise_id, user_id, expires_at)
select p.id, pp.user_id,
  now() + pg_catalog.make_interval(days => public.lf_retention_free_days())
from public.promises p join public.promise_participants pp on pp.promise_id = p.id
where p.activated_at is not null and pp.user_id is not null and pp.status = 'JOINED'
on conflict (promise_id, user_id) do nothing;

create or replace function public.lf_reward_action_allowed(
  p_actor uuid,
  p_promise_id uuid,
  p_action text
)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.participant_role; v_promise public.promises%rowtype;
begin
  select * into v_promise from public.promises p where p.id = p_promise_id;
  if not found or v_promise.purge_state <> 'AVAILABLE' then return false; end if;
  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.user_id = p_actor and pp.status = 'JOINED';
  if v_role is null or not public.lf_has_record_access(p_actor, p_promise_id, now()) then
    return false;
  end if;
  if p_action = 'WITNESS_CREATOR' then
    return v_role = 'CREATOR'
      and public.lf_reward_grant_count(p_promise_id, p_actor, p_action) = 0
      and v_promise.status in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING');
  elsif p_action = 'WITNESS_PARTNER' then
    return v_role = 'PARTNER'
      and public.lf_reward_grant_count(p_promise_id, p_actor, p_action) = 0
      and v_promise.status in ('ACTIVE', 'AMEND_PENDING', 'CHECKING');
  elsif p_action = 'DURATION_30D' then
    return v_role = 'CREATOR'
      and not public.lf_permanent_access_effective(p_promise_id, p_actor)
      and v_promise.status in ('DRAFT', 'PENDING', 'ACTIVE', 'AMEND_PENDING');
  elsif p_action = 'RETENTION_30D' then
    return v_promise.activated_at is not null
      and public.lf_retention_anchor_of(p_promise_id) is not null
      and not public.lf_permanent_access_effective(p_promise_id, p_actor);
  end if;
  return false;
end;
$$;

create or replace function public.lf_reward_intent_create(
  p_actor uuid,
  p_promise_id uuid,
  p_action text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text; v_opaque text; v_expires timestamptz;
begin
  perform public.lf_assert_actor(p_actor);
  if not public.lf_rewarded_ads_enabled() then raise exception 'E_REWARD_NOT_ELIGIBLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_reward:' || p_promise_id::text, 0)
  );
  if not public.lf_reward_action_allowed(p_actor, p_promise_id, p_action) then
    raise exception 'E_REWARD_NOT_ELIGIBLE';
  end if;
  select ri.id, ri.status, ri.opaque_user_id, ri.expires_at
    into v_id, v_status, v_opaque, v_expires
    from public.reward_intents ri
   where ri.user_id = p_actor and ri.promise_id = p_promise_id
     and ri.action = p_action and ri.status = 'PENDING' and ri.expires_at > now()
   for update;
  if found then
    return pg_catalog.jsonb_build_object(
      'intent_id', v_id, 'status', v_status,
      'opaque_user_id', v_opaque, 'expires_at', v_expires
    );
  end if;
  update public.reward_intents set status = 'REJECTED'
   where user_id = p_actor and promise_id = p_promise_id
     and action = p_action and status = 'PENDING';
  v_id := gen_random_uuid();
  v_opaque := encode(sha256(convert_to(p_actor::text || ':' || v_id::text, 'UTF8')), 'hex');
  v_expires := now() + pg_catalog.make_interval(mins => public.lf_reward_intent_ttl_minutes());
  insert into public.reward_intents (
    id, user_id, promise_id, action, opaque_user_id, expires_at
  ) values (v_id, p_actor, p_promise_id, p_action, v_opaque, v_expires);
  return pg_catalog.jsonb_build_object(
    'intent_id', v_id, 'status', 'PENDING',
    'opaque_user_id', v_opaque, 'expires_at', v_expires
  );
end;
$$;

create or replace function public.lf_reward_grant(
  p_intent_id uuid,
  p_opaque_user_id text,
  p_source text,
  p_transaction_id text default null,
  p_ad_unit_id text default null,
  p_rewarded_at timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_intent public.reward_intents%rowtype; v_promise_id uuid;
begin
  -- 지급 출처는 AdMob SSV 하나뿐이다(광고 미노출 대체 지급 제거, PO 2026-08-29). 다른 값은
  -- 호출 경로가 잘못된 것이므로 '미지급'으로 조용히 넘기지 않고 실패시킨다.
  if p_source <> 'ADMOB_SSV' then raise exception 'E_VALIDATION'; end if;
  -- 잠금 순서 불변식: 약속 advisory lock → intent 행. lf_reward_intent_create 가 같은 순서로
  -- 잡으므로 여기서 행을 먼저 잠그면 두 경로가 서로를 기다리는 교착(ABBA)이 된다. 그래서
  -- promise_id 는 잠그지 않고 읽고, advisory lock 을 잡은 뒤에야 행을 다시 읽어 잠근다.
  select ri.promise_id into v_promise_id from public.reward_intents ri where ri.id = p_intent_id;
  if not found then return pg_catalog.jsonb_build_object('granted', false); end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_reward:' || v_promise_id::text, 0)
  );
  select * into v_intent from public.reward_intents ri where ri.id = p_intent_id for update;
  if not found then return pg_catalog.jsonb_build_object('granted', false); end if;
  if v_intent.opaque_user_id <> p_opaque_user_id then
    return pg_catalog.jsonb_build_object('granted', false);
  end if;
  if v_intent.status = 'GRANTED' then return pg_catalog.jsonb_build_object('granted', true); end if;
  if v_intent.status <> 'PENDING' then return pg_catalog.jsonb_build_object('granted', false); end if;
  -- AdMob 은 2xx 가 아니면 콜백을 재시도하므로, TTL 은 도착 시각이 아니라 서명된 시청 시각
  -- (p_rewarded_at)으로 판정한다. TTL 을 놓친 콜백은 intent 를 건드리지 않는다 — REJECTED 로
  -- 바꾸면 같은 intent 의 유효한 재시도 콜백까지 버리게 된다.
  if coalesce(p_rewarded_at, now()) > v_intent.expires_at then
    return pg_catalog.jsonb_build_object('granted', false);
  end if;
  if not public.lf_reward_action_allowed(
    v_intent.user_id, v_intent.promise_id, v_intent.action
  ) then
    update public.reward_intents set status = 'REJECTED' where id = p_intent_id;
    return pg_catalog.jsonb_build_object('granted', false);
  end if;
  if nullif(pg_catalog.btrim(p_transaction_id), '') is null or exists (
    select 1 from public.reward_intents ri where ri.transaction_id = p_transaction_id
  ) then return pg_catalog.jsonb_build_object('granted', false); end if;

  insert into public.promise_reward_grants (
    promise_id, user_id, action, source, intent_id
  ) values (
    v_intent.promise_id, v_intent.user_id, v_intent.action, p_source, v_intent.id
  );
  update public.reward_intents
     set status = 'GRANTED', transaction_id = p_transaction_id, ad_unit_id = p_ad_unit_id,
         rewarded_at = p_rewarded_at, granted_at = now()
   where id = p_intent_id;
  return pg_catalog.jsonb_build_object('granted', true);
end;
$$;

create or replace function public.lf_reward_status(p_actor uuid, p_intent_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_intent public.reward_intents%rowtype;
begin
  perform public.lf_assert_actor(p_actor);
  select * into v_intent from public.reward_intents ri
   where ri.id = p_intent_id and ri.user_id = p_actor;
  if not found then raise exception 'E_NOT_FOUND'; end if;
  return pg_catalog.jsonb_build_object(
    'intent_id', v_intent.id,
    'status', v_intent.status,
    'entitlements', case when v_intent.status = 'GRANTED'
      then public.lf_promise_entitlements(p_actor, v_intent.promise_id) else null end
  );
end;
$$;

create or replace function public.lf_witness_invite_list(
  p_actor uuid,
  p_promise_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_response jsonb; v_promise public.promises%rowtype; v_partner_id uuid;
  v_creator_capacity int; v_partner_capacity int;
begin
  perform public.lf_assert_actor(p_actor);
  if not public.lf_has_record_access(p_actor, p_promise_id, now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  select * into strict v_promise from public.promises where id = p_promise_id;
  select pp.user_id into v_partner_id from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.role = 'PARTNER' and pp.status = 'JOINED';
  v_creator_capacity := public.lf_witness_creator_free() + least(1,
    public.lf_reward_grant_count(p_promise_id, v_promise.creator_id, 'WITNESS_CREATOR'));
  v_partner_capacity := case when v_partner_id is null then 0 else least(1,
    public.lf_reward_grant_count(p_promise_id, v_partner_id, 'WITNESS_PARTNER')) end;

  select pg_catalog.jsonb_build_object(
    'promise_id', p_promise_id,
    'occupied_count', count(*)::int,
    'capacity', v_creator_capacity + v_partner_capacity,
    'witness_max', public.lf_witness_max(),
    'creator_capacity', v_creator_capacity,
    'partner_capacity', v_partner_capacity,
    'witnesses', coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'participant_id', q.participant_id, 'status', q.status,
        'nickname', q.nickname, 'profile_image_url', q.profile_image_url,
        'expires_at', q.expires_at, 'signed_at', q.signed_at
      ) order by q.invited_at, q.participant_id
    ), '[]'::jsonb)
  ) into v_response
  from (
    select pp.id participant_id, pp.status, u.nickname, u.profile_image_url,
      null::timestamptz expires_at,
      (select a.acted_at from public.approvals a
        where a.promise_id = pp.promise_id and a.user_id = pp.user_id
          and a.action = 'WITNESS_SIGN' order by a.acted_at, a.id limit 1) signed_at,
      pp.invited_at
    from public.promise_participants pp join public.users u on u.id = pp.user_id
    where pp.promise_id = p_promise_id and pp.role = 'WITNESS' and pp.status = 'JOINED'
    union all
    select pp.id, pp.status, null::varchar, null::text, i.expires_at,
      null::timestamptz, pp.invited_at
    from public.promise_participants pp join public.invitations i on i.id = pp.invitation_id
    where pp.promise_id = p_promise_id and pp.role = 'WITNESS'
      and pp.status = 'INVITED' and pp.user_id is null
      and i.status = 'PENDING' and i.expires_at > now()
  ) q;
  return v_response;
end;
$$;

create or replace function public.lf_witness_invite(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_token_hash char(64),
  p_participant_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cached jsonb; v_promise public.promises%rowtype;
  v_participant public.promise_participants%rowtype; v_previous public.invitations%rowtype;
  v_role public.participant_role; v_capacity int; v_used int;
  v_invitation_id uuid; v_participant_id uuid; v_expires_at timestamptz;
  v_resend_count int := 0; v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-invite');
  if v_cached is not null then return v_cached; end if;
  select * into v_promise from public.promises where id = p_promise_id for update;
  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER') and pp.status = 'JOINED';
  if not found or v_role is null or not public.lf_has_record_access(p_actor, p_promise_id, now())
  then raise exception 'E_NOT_FOUND'; end if;
  if v_promise.status not in ('PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING') then
    raise exception 'E_STATE_CONFLICT';
  end if;
  v_capacity := case when v_role = 'CREATOR' then public.lf_witness_creator_free()
      + least(1, public.lf_reward_grant_count(
        p_promise_id, p_actor, 'WITNESS_CREATOR'
      ))
    else least(1, public.lf_reward_grant_count(
      p_promise_id, p_actor, 'WITNESS_PARTNER'
    )) end;
  if p_participant_id is null then
    v_used := public.lf_witness_used(p_promise_id, p_actor);
    if v_used >= v_capacity then raise exception 'E_WITNESS_LIMIT'; end if;
  else
    select * into v_participant from public.promise_participants
     where id = p_participant_id and promise_id = p_promise_id and role = 'WITNESS'
       and status = 'INVITED' and user_id is null and invited_by_user_id = p_actor
     for update;
    if not found or v_participant.invitation_id is null then raise exception 'E_NOT_FOUND'; end if;
    select * into strict v_previous from public.invitations
     where id = v_participant.invitation_id for update;
    v_resend_count := v_previous.resend_count + 1;
    if v_resend_count > public.lf_invite_resend_max() then raise exception 'E_RATE_LIMIT'; end if;
    update public.invitations set status = 'REVOKED' where id = v_previous.id
      and status in ('PENDING', 'EXPIRED');
  end if;
  v_expires_at := now() + pg_catalog.make_interval(hours => public.lf_invite_ttl_hours());
  insert into public.invitations (
    promise_id, target_role, token_hash, created_by, expires_at, status,
    resend_count, parent_invitation_id
  ) values (
    p_promise_id, 'WITNESS', p_token_hash, p_actor, v_expires_at, 'PENDING',
    v_resend_count, case when p_participant_id is null then null else v_previous.id end
  ) returning id into v_invitation_id;
  if p_participant_id is null then
    insert into public.promise_participants (
      promise_id, role, status, invited_at, invitation_id, invited_by_user_id
    ) values (
      p_promise_id, 'WITNESS', 'INVITED', now(), v_invitation_id, p_actor
    ) returning id into v_participant_id;
  else
    update public.promise_participants set invitation_id = v_invitation_id, invited_at = now()
     where id = p_participant_id returning id into v_participant_id;
  end if;
  v_response := pg_catalog.jsonb_build_object(
    'promise_id', p_promise_id, 'participant_id', v_participant_id,
    'invitation_id', v_invitation_id, 'title', v_promise.title,
    'expires_at', v_expires_at, 'token_hash', p_token_hash
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_permanent_access_grant(
  p_user_id uuid,
  p_promise_id uuid,
  p_product_id text,
  p_order_id text,
  p_purchase_token text,
  p_purchase_time timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing public.slot_purchases%rowtype;
begin
  perform public.lf_assert_actor(p_user_id);
  if p_product_id <> public.lf_permanent_access_product_id() then
    raise exception 'E_VALIDATION';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_reward:' || p_promise_id::text, 0)
  );
  if not public.lf_has_record_access(p_user_id, p_promise_id, now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  insert into public.slot_purchases (
    user_id, provider, product_id, order_id, purchase_token, purchase_time,
    granted_slots, promise_id
  ) values (
    p_user_id, 'google_play', p_product_id, p_order_id, p_purchase_token,
    p_purchase_time, 0, p_promise_id
  ) on conflict (order_id) do nothing;
  if not found then
    select * into v_existing from public.slot_purchases sp where sp.order_id = p_order_id;
    if v_existing.user_id <> p_user_id or v_existing.promise_id <> p_promise_id
       or v_existing.product_id <> p_product_id then raise exception 'E_VALIDATION'; end if;
  end if;
  return public.lf_promise_entitlements(p_user_id, p_promise_id);
end;
$$;

create or replace function public.lf_slot_revoke(
  p_purchase_token text,
  p_voided_at timestamptz,
  p_voided_source int,
  p_voided_reason int
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_purchase_id uuid;
begin
  select sp.id into v_purchase_id from public.slot_purchases sp
   where sp.purchase_token = p_purchase_token;
  if not found then return false; end if;
  insert into public.slot_purchase_revocations (
    purchase_id, voided_at, voided_source, voided_reason
  ) values (
    v_purchase_id, p_voided_at, p_voided_source, p_voided_reason
  ) on conflict (purchase_id) do nothing;
  if not found then return false; end if;
  return true;
end;
$$;

alter table public.notification_outbox drop constraint notification_outbox_event_check;
alter table public.notification_outbox add constraint notification_outbox_event_check check (
  event in (
    'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05', 'NT-06', 'NT-07',
    'NT-08', 'NT-09', 'NT-10', 'NT-11', 'NT-12', 'NT-13', 'NT-14',
    'NT-15', 'NT-16', 'NT-17', 'NT-18', 'NT-19', 'NT-20', 'NT-21',
    'NT-22', 'NT-23'
  )
);

create or replace function public.lf_retention_maintenance(p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row record; v_expiry timestamptz; v_warned int := 0; v_queued int := 0;
  v_warning_days int[] := public.lf_retention_warning_days();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_retention_maintenance', 0)
  );
  for v_row in
    select p.id promise_id, p.title, pp.user_id
      from public.promises p join public.promise_participants pp on pp.promise_id = p.id
     where p.activated_at is not null and p.purge_state = 'AVAILABLE'
       and pp.user_id is not null and pp.status = 'JOINED'
  loop
    v_expiry := public.lf_access_expires_at(v_row.promise_id, v_row.user_id);
    -- 창은 하루 폭이다. 한 시간 폭으로 두면 워커가 그 한 번을 놓쳤을 때(장애·배포·시각 어긋남)
    -- 경고가 영영 안 나간다. 하루 안의 반복 실행은 만료일이 들어간 dedupe scope 가 한 번으로 접는다.
    if v_expiry is not null and v_expiry > p_now then
      if v_expiry <= p_now + pg_catalog.make_interval(days => v_warning_days[1])
         and v_expiry > p_now + pg_catalog.make_interval(days => v_warning_days[1] - 1) then
        perform public.lf_notification_outbox_enqueue(
          v_row.user_id, v_row.promise_id, 'NT-22',
          pg_catalog.jsonb_build_object('promiseTitle', v_row.title),
          to_char(v_expiry at time zone 'Asia/Seoul', 'YYYYMMDD')
            || ':RETENTION_D' || v_warning_days[1], p_now
        );
        v_warned := v_warned + 1;
      elsif v_expiry <= p_now + pg_catalog.make_interval(days => v_warning_days[2])
         and v_expiry > p_now + pg_catalog.make_interval(days => v_warning_days[2] - 1) then
        perform public.lf_notification_outbox_enqueue(
          v_row.user_id, v_row.promise_id, 'NT-23',
          pg_catalog.jsonb_build_object('promiseTitle', v_row.title),
          to_char(v_expiry at time zone 'Asia/Seoul', 'YYYYMMDD')
            || ':RETENTION_D' || v_warning_days[2], p_now
        );
        v_warned := v_warned + 1;
      end if;
    end if;
  end loop;

  for v_row in
    select p.id from public.promises p
     where p.purge_state = 'AVAILABLE'
       and (
         (p.activated_at is not null and not exists (
           select 1 from public.promise_participants pp
            where pp.promise_id = p.id and pp.user_id is not null and pp.status = 'JOINED'
              and public.lf_has_record_access(pp.user_id, p.id, p_now)
         ))
         or (p.activated_at is null and p.status = 'PENDING' and coalesce(
           (select max(i.expires_at) from public.invitations i where i.promise_id = p.id),
           p.updated_at
         ) + interval '30 days' <= p_now)
         or (p.activated_at is null and p.status in ('DECLINED', 'CANCELED')
           and p.closed_at is not null and p.closed_at + interval '30 days' <= p_now)
       )
     order by p.id for update skip locked
  loop
    update public.promises set purge_state = 'PURGING', updated_at = p_now where id = v_row.id;
    insert into public.promise_purge_jobs (promise_id) values (v_row.id)
      on conflict (promise_id) do nothing;
    v_queued := v_queued + 1;
  end loop;
  return pg_catalog.jsonb_build_object('warned', v_warned, 'queued', v_queued);
end;
$$;

create or replace function public.lf_purge_job_claim(p_now timestamptz, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'E_VALIDATION'; end if;
  with candidates as (
    select ppj.promise_id from public.promise_purge_jobs ppj
     where ppj.status = 'PENDING'
        or (ppj.status = 'LEASED' and ppj.lease_expires_at <= p_now)
     order by ppj.created_at for update skip locked limit p_limit
  ), claimed as (
    update public.promise_purge_jobs ppj
       set status = 'LEASED', lease_id = gen_random_uuid(),
           lease_expires_at = p_now + interval '10 minutes'
      from candidates c where ppj.promise_id = c.promise_id
    returning ppj.promise_id, ppj.lease_id
  )
  select pg_catalog.jsonb_build_object('items', coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'promise_id', c.promise_id, 'lease_id', c.lease_id,
      'storage_keys', coalesce((select pg_catalog.jsonb_agg(k.storage_key)
        from (
          select fe.storage_key from public.fulfillment_evidences fe
           where fe.promise_id = c.promise_id
          union
          select fe.thumb_key from public.fulfillment_evidences fe
           where fe.promise_id = c.promise_id and fe.thumb_key is not null
          union
          select eu.storage_key from public.evidence_uploads eu
           where eu.promise_id = c.promise_id and eu.storage_key is not null
          union
          select eu.thumb_key from public.evidence_uploads eu
           where eu.promise_id = c.promise_id and eu.thumb_key is not null
        ) k), '[]'::jsonb)
    )
  ), '[]'::jsonb)) into v_result from claimed c;
  return v_result;
end;
$$;

create or replace function public.lf_purge_job_finalize(
  p_promise_id uuid,
  p_lease_id uuid,
  p_now timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_promise public.promises%rowtype; v_digest char(64); v_inserted boolean;
  v_user_id uuid; v_user_ids uuid[];
begin
  perform 1 from public.promise_purge_jobs ppj
   where ppj.promise_id = p_promise_id and ppj.status = 'LEASED'
     and ppj.lease_id = p_lease_id and ppj.lease_expires_at > p_now for update;
  if not found then return false; end if;
  select * into strict v_promise from public.promises where id = p_promise_id for update;
  if v_promise.purge_state <> 'PURGING' then return false; end if;
  -- 대기열 판정과 finalize 사이에 영구보존 구매나 보존 연장이 끼어들 수 있다. 접근 가능한
  -- 참여자가 한 명이라도 남았으면 지우지 않고 AVAILABLE 로 되돌린다 — 결제 직후 기록이
  -- 사라지면 환불 분쟁이다. lf_has_record_access 는 PURGING 에서 무조건 거짓이라 먼저 되돌린
  -- 뒤 판정한다. 지우는 경로는 행 자체가 사라지므로 되돌린 값이 남지 않는다. 성립 전 기록의
  -- 정리 기준은 시간뿐이라(구매가 접근을 되살리지 않는다) 재판정하지 않는다.
  if v_promise.activated_at is not null then
    update public.promises set purge_state = 'AVAILABLE' where id = p_promise_id;
    if exists (
      select 1 from public.promise_participants pp
       where pp.promise_id = p_promise_id and pp.user_id is not null and pp.status = 'JOINED'
         and public.lf_has_record_access(pp.user_id, p_promise_id, p_now)
    ) then
      delete from public.promise_purge_jobs where promise_id = p_promise_id;
      return false;
    end if;
  end if;
  v_digest := encode(sha256(convert_to(p_promise_id::text, 'UTF8')), 'hex')::char(64);
  insert into public.purged_promise_receipts (promise_digest, purged_at)
  values (v_digest, p_now) on conflict do nothing;
  v_inserted := found;
  if v_inserted and v_promise.activated_at is not null then
    insert into public.user_keep_rate_aggregates (
      user_id, completed_count, broken_count, disputed_count, unresolved_count, updated_at
    )
    select pp.user_id,
      case when v_promise.status = 'COMPLETED' and (
        (pp.role = 'CREATOR' and v_promise.keeper in ('CREATOR', 'BOTH')) or
        (pp.role = 'PARTNER' and v_promise.keeper in ('PARTNER', 'BOTH'))
      ) then 1 else 0 end,
      case when v_promise.status = 'BROKEN' and (
        (pp.role = 'CREATOR' and v_promise.keeper in ('CREATOR', 'BOTH')) or
        (pp.role = 'PARTNER' and v_promise.keeper in ('PARTNER', 'BOTH'))
      ) then 1 else 0 end,
      case when v_promise.status = 'DISPUTED' then 1 else 0 end,
      case when v_promise.status = 'UNRESOLVED' then 1 else 0 end,
      p_now
    from public.promise_participants pp where pp.promise_id = p_promise_id
      and pp.user_id is not null and pp.role in ('CREATOR', 'PARTNER') and pp.status = 'JOINED'
    on conflict (user_id) do update set
      completed_count = user_keep_rate_aggregates.completed_count + excluded.completed_count,
      broken_count = user_keep_rate_aggregates.broken_count + excluded.broken_count,
      disputed_count = user_keep_rate_aggregates.disputed_count + excluded.disputed_count,
      unresolved_count = user_keep_rate_aggregates.unresolved_count + excluded.unresolved_count,
      updated_at = excluded.updated_at;
  end if;
  select array_agg(pp.user_id) into v_user_ids from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.user_id is not null
     and pp.role in ('CREATOR', 'PARTNER');
  -- 신고는 기록보다 오래 산다(운영 근거). reports.evidence_id 는 fulfillment_evidences 를
  -- no action 으로 참조하므로 promise_id 만 비우면 증빙 cascade 삭제가 FK 위반으로 막힌다.
  update public.reports set evidence_id = null where evidence_id in (
    select fe.id from public.fulfillment_evidences fe where fe.promise_id = p_promise_id
  );
  update public.reports set promise_id = null where promise_id = p_promise_id;
  delete from public.approvals where promise_id = p_promise_id;
  delete from public.promises where id = p_promise_id;
  foreach v_user_id in array coalesce(v_user_ids, '{}'::uuid[]) loop
    perform public.lf_recompute_trust_profile(v_user_id);
  end loop;
  return true;
end;
$$;

create or replace function public.lf_recompute_trust_profile(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_completed int; v_broken int; v_disputed int; v_unresolved int;
  v_active int; v_keep_rate int; v_response jsonb; v_archive public.user_keep_rate_aggregates%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf_trust_profile:' || p_user_id::text, 0)
  );
  select count(*) filter (where p.status = 'COMPLETED' and (
      (pp.role = 'CREATOR' and p.keeper in ('CREATOR','BOTH')) or
      (pp.role = 'PARTNER' and p.keeper in ('PARTNER','BOTH'))))::int,
    count(*) filter (where p.status = 'BROKEN' and (
      (pp.role = 'CREATOR' and p.keeper in ('CREATOR','BOTH')) or
      (pp.role = 'PARTNER' and p.keeper in ('PARTNER','BOTH'))))::int,
    count(*) filter (where p.status = 'DISPUTED')::int,
    count(*) filter (where p.status = 'UNRESOLVED')::int,
    count(*) filter (where p.status in ('PENDING','ACTIVE','AMEND_PENDING','CHECKING'))::int
  into v_completed, v_broken, v_disputed, v_unresolved, v_active
  from public.promise_participants pp join public.promises p on p.id = pp.promise_id
  where pp.user_id = p_user_id and pp.role in ('CREATOR','PARTNER') and pp.status = 'JOINED';
  select * into v_archive from public.user_keep_rate_aggregates where user_id = p_user_id;
  v_completed := coalesce(v_completed,0) + coalesce(v_archive.completed_count,0);
  v_broken := coalesce(v_broken,0) + coalesce(v_archive.broken_count,0);
  v_disputed := coalesce(v_disputed,0) + coalesce(v_archive.disputed_count,0);
  v_unresolved := coalesce(v_unresolved,0) + coalesce(v_archive.unresolved_count,0);
  v_keep_rate := case when v_completed + v_broken < public.lf_trust_min_sample() then null
    else round(v_completed * 100.0 / (v_completed + v_broken))::int end;
  insert into public.trust_profiles (
    user_id, completed_count, broken_count, disputed_count, unresolved_count,
    active_count, keep_rate, updated_at
  ) values (
    p_user_id, v_completed, v_broken, v_disputed, v_unresolved,
    v_active, v_keep_rate, now()
  ) on conflict (user_id) do update set
    completed_count = excluded.completed_count, broken_count = excluded.broken_count,
    disputed_count = excluded.disputed_count, unresolved_count = excluded.unresolved_count,
    active_count = excluded.active_count, keep_rate = excluded.keep_rate, updated_at = now()
  returning to_jsonb(trust_profiles) into v_response;
  return v_response;
end;
$$;

create or replace function public.lf_promise_finish_request(
  p_idempotency_key uuid, p_actor uuid, p_promise_id uuid, p_reason text,
  p_surface public.surface, p_ip_hash text, p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cached jsonb; v_promise public.promises%rowtype;
  v_current public.promise_versions%rowtype; v_role public.participant_role;
  v_reason text := nullif(public.lf_normalize_input(p_reason), '');
  v_request_id uuid; v_expires_at timestamptz; v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'promise-amend-request'
  );
  if v_cached is not null then return v_cached; end if;
  select * into v_promise from public.promises where id = p_promise_id for update;
  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id = p_promise_id and pp.user_id = p_actor
     and pp.role in ('CREATOR','PARTNER') and pp.status = 'JOINED';
  if not found or v_role is null or not public.lf_has_record_access(p_actor,p_promise_id,now())
  then raise exception 'E_NOT_FOUND'; end if;
  if v_promise.status <> 'ACTIVE' or v_promise.end_date is not null then
    raise exception 'E_STATE_CONFLICT';
  end if;
  if char_length(coalesce(v_reason,'')) > 200 then raise exception 'E_VALIDATION'; end if;
  select * into strict v_current from public.promise_versions
   where id = v_promise.current_version_id and activated_at is not null;
  v_expires_at := now() + pg_catalog.make_interval(days => public.lf_amend_auto_withdraw_days());
  insert into public.amend_requests (
    promise_id, requester_id, type, proposed_version_id, reason, expires_at
  ) values (p_promise_id,p_actor,'FINISH',null,v_reason,v_expires_at)
  returning id into v_request_id;
  update public.promises set status='AMEND_PENDING', lock_version=lock_version+1, updated_at=now()
   where id=p_promise_id and status='ACTIVE';
  insert into public.approvals (
    promise_id,version_id,user_id,role,action,content_hash,comment,surface,ip_hash,user_agent_hash
  ) values (
    p_promise_id,v_current.id,p_actor,v_role,'FINISH_REQUEST',v_current.content_hash,
    v_reason,p_surface,p_ip_hash,p_user_agent_hash
  );
  v_response := pg_catalog.jsonb_build_object(
    'promise_id',p_promise_id,'status','AMEND_PENDING','request_id',v_request_id,
    'type','FINISH','expires_at',v_expires_at
  );
  perform public.lf_idempotency_finish(p_idempotency_key,v_response);
  return v_response;
end;
$$;

create or replace function public.lf_promise_finish_respond(
  p_idempotency_key uuid, p_actor uuid, p_promise_id uuid, p_request_id uuid,
  p_decision text, p_surface public.surface, p_ip_hash text, p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cached jsonb; v_promise public.promises%rowtype; v_request public.amend_requests%rowtype;
  v_current public.promise_versions%rowtype; v_role public.participant_role;
  v_action public.approval_action; v_status public.promise_status; v_response jsonb;
  v_started timestamptz;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,p_actor,'promise-amend-respond'
  );
  if v_cached is not null then return v_cached; end if;
  select * into v_promise from public.promises where id=p_promise_id for update;
  select * into v_request from public.amend_requests where id=p_request_id
    and promise_id=p_promise_id and type='FINISH' and status='PENDING' for update;
  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id=p_promise_id and pp.user_id=p_actor
     and pp.role in ('CREATOR','PARTNER') and pp.status='JOINED';
  if v_promise.id is null or v_request.id is null or v_role is null
     or not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_promise.status <> 'AMEND_PENDING' or v_request.requester_id=p_actor
     or v_request.expires_at<=now() then raise exception 'E_STATE_CONFLICT'; end if;
  if p_decision not in ('APPROVE','DECLINE') then raise exception 'E_VALIDATION'; end if;
  select * into strict v_current from public.promise_versions
   where id=v_promise.current_version_id and activated_at is not null;
  update public.amend_requests set status=case when p_decision='APPROVE'
      then 'APPROVED'::public.amend_status else 'DECLINED'::public.amend_status end,
    responded_by=p_actor, responded_at=now() where id=p_request_id;
  if p_decision='DECLINE' then
    update public.promises set status='ACTIVE',lock_version=lock_version+1,updated_at=now()
     where id=p_promise_id;
    v_action := 'FINISH_DECLINE'; v_status := 'ACTIVE';
  else
    v_started := now();
    update public.promises set status='CHECKING',checking_started_at=v_started,
      check_deadline_at=v_started+pg_catalog.make_interval(
        days=>public.lf_policy_config_int('check_deadline_days')
      ),
      retention_anchor_at=v_started,lock_version=lock_version+1,updated_at=v_started
     where id=p_promise_id;
    insert into public.reminder_schedules (promise_id,user_id,kind,fire_at,check_round_no)
    select p_promise_id,pp.user_id,s.kind::public.reminder_kind,s.fire_at,v_promise.check_round_no
    from public.promise_participants pp cross join lateral (values
      ('CHECK_REQ',v_started),('CHECK_R1',v_started+interval '2 days'),
      ('CHECK_R2',v_started+interval '5 days')) s(kind,fire_at)
    where pp.promise_id=p_promise_id and pp.role in ('CREATOR','PARTNER')
      and pp.status='JOINED' and pp.user_id is not null
    on conflict (promise_id,user_id,kind,check_round_no)
      where kind in ('CHECK_REQ','CHECK_R1','CHECK_R2') and check_round_no is not null do nothing;
    v_action := 'FINISH_APPROVE'; v_status := 'CHECKING';
  end if;
  insert into public.approvals (
    promise_id,version_id,user_id,role,action,content_hash,surface,ip_hash,user_agent_hash
  ) values (
    p_promise_id,v_current.id,p_actor,v_role,v_action,v_current.content_hash,
    p_surface,p_ip_hash,p_user_agent_hash
  );
  v_response:=pg_catalog.jsonb_build_object(
    'promise_id',p_promise_id,'status',v_status,'request_id',p_request_id,
    'request_status',case when p_decision='APPROVE' then 'APPROVED' else 'DECLINED' end,
    'version_no',null
  );
  perform public.lf_idempotency_finish(p_idempotency_key,v_response);
  return v_response;
end;
$$;

-- F-11 트리거 본문을 그대로 옮기고 FINISH_* 행위만 더했다. 종료 요청이 상대에게 알려지지
-- 않으면 요청자는 3일 리마인드도 없이 7일 뒤 자동 철회(NT-17)만 보게 된다.
create or replace function public.lf_approval_notification_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_creator_id uuid;
  v_promise_title text;
  v_partner_nickname text;
  v_recipient_id uuid;
  v_request public.amend_requests%rowtype;
  v_amend_type public.amend_type;
  v_amend_decision text;
begin
  if new.action in ('AMEND_REQUEST', 'CANCEL_REQUEST', 'FINISH_REQUEST') then
    v_amend_type := case new.action
      when 'AMEND_REQUEST' then 'AMEND'::public.amend_type
      when 'CANCEL_REQUEST' then 'CANCEL'::public.amend_type
      else 'FINISH'::public.amend_type
    end;
    select ar.*
      into v_request
      from public.amend_requests ar
     where ar.promise_id = new.promise_id
       and ar.requester_id = new.user_id
       and ar.type = v_amend_type
       and ar.status = 'PENDING'
     order by ar.created_at desc, ar.id desc
     limit 1;
    if not found then raise exception 'E_STATE_CONFLICT'; end if;

    select p.title, actor.nickname, recipient.user_id
      into v_promise_title, v_partner_nickname, v_recipient_id
      from public.promises p
      join public.users actor on actor.id = new.user_id
      join public.promise_participants recipient
        on recipient.promise_id = p.id
       and recipient.role in ('CREATOR', 'PARTNER')
       and recipient.status = 'JOINED'
       and recipient.user_id <> new.user_id
     where p.id = new.promise_id;
    if v_recipient_id is null then raise exception 'E_STATE_CONFLICT'; end if;

    perform public.lf_notification_outbox_enqueue(
      v_recipient_id,
      new.promise_id,
      'NT-15',
      pg_catalog.jsonb_build_object(
        'partnerNickname', v_partner_nickname,
        'promiseTitle', v_promise_title,
        'amendType', v_amend_type
      ),
      'amend-request:' || v_request.id::text,
      new.acted_at
    );

    insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
    values (
      new.promise_id,
      v_recipient_id,
      'AMEND_REMIND',
      (
        ((v_request.created_at at time zone 'Asia/Seoul')::date + 3)::timestamp
        + interval '9 hours'
      ) at time zone 'Asia/Seoul'
    )
    on conflict (promise_id, user_id, kind)
      where kind = 'AMEND_REMIND' and status = 'PENDING'
      do nothing;
    return new;
  end if;

  if new.action in (
    'AMEND_APPROVE', 'AMEND_DECLINE', 'CANCEL_APPROVE', 'CANCEL_DECLINE',
    'FINISH_APPROVE', 'FINISH_DECLINE'
  ) then
    v_amend_type := case
      when new.action in ('AMEND_APPROVE', 'AMEND_DECLINE') then 'AMEND'::public.amend_type
      when new.action in ('CANCEL_APPROVE', 'CANCEL_DECLINE') then 'CANCEL'::public.amend_type
      else 'FINISH'::public.amend_type
    end;
    v_amend_decision := case
      when new.action in ('AMEND_APPROVE', 'CANCEL_APPROVE', 'FINISH_APPROVE') then 'APPROVE'
      else 'DECLINE'
    end;
    select ar.*
      into v_request
      from public.amend_requests ar
     where ar.promise_id = new.promise_id
       and ar.responded_by = new.user_id
       and ar.type = v_amend_type
       and ar.status = case when v_amend_decision = 'APPROVE'
         then 'APPROVED'::public.amend_status
         else 'DECLINED'::public.amend_status
       end
     order by ar.responded_at desc, ar.id desc
     limit 1;
    if not found then raise exception 'E_STATE_CONFLICT'; end if;

    select p.title into strict v_promise_title
      from public.promises p where p.id = new.promise_id;
    perform public.lf_notification_outbox_enqueue(
      v_request.requester_id,
      new.promise_id,
      'NT-16',
      pg_catalog.jsonb_build_object(
        'promiseTitle', v_promise_title,
        'amendDecision', v_amend_decision
      ),
      'amend-response:' || v_request.id::text || ':' || lower(v_amend_decision),
      new.acted_at
    );
    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = new.promise_id
       and kind = 'AMEND_REMIND'
       and status = 'PENDING';
    return new;
  end if;

  if new.action in ('AMEND_WITHDRAW', 'FINISH_WITHDRAW') then
    update public.reminder_schedules
       set status = 'CANCELED'
     where promise_id = new.promise_id
       and kind = 'AMEND_REMIND'
       and status = 'PENDING';
    return new;
  end if;

  if new.role <> 'PARTNER' or new.version_id is null then
    return new;
  end if;

  v_event := case new.action
    when 'APPROVE' then 'NT-01'
    when 'DECLINE' then 'NT-02'
    when 'AMEND_SUGGEST' then 'NT-03'
    else null
  end;
  if v_event is null then return new; end if;

  select p.creator_id, pv.title, u.nickname
    into v_creator_id, v_promise_title, v_partner_nickname
    from public.promises p
    join public.promise_versions pv on pv.id = new.version_id
    join public.users u on u.id = new.user_id
   where p.id = new.promise_id;

  perform public.lf_notification_outbox_enqueue(
    v_creator_id,
    new.promise_id,
    v_event,
    pg_catalog.jsonb_build_object(
      'partnerNickname', v_partner_nickname,
      'promiseTitle', v_promise_title
    ),
    'approval:' || new.id::text,
    new.acted_at
  );
  return new;
end;
$$;
revoke all on function public.lf_approval_notification_outbox() from public, anon, authenticated;
grant execute on function public.lf_approval_notification_outbox() to service_role;

create or replace function public.lf_promise_amend_respond_v2(
  p_idempotency_key uuid, p_actor uuid, p_promise_id uuid, p_request_id uuid,
  p_decision text, p_surface public.surface, p_ip_hash text, p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_type public.amend_type;
begin
  select ar.type into v_type from public.amend_requests ar
   where ar.id=p_request_id and ar.promise_id=p_promise_id;
  if v_type='FINISH' then
    return public.lf_promise_finish_respond(
      p_idempotency_key,p_actor,p_promise_id,p_request_id,p_decision,
      p_surface,p_ip_hash,p_user_agent_hash
    );
  end if;
  return public.lf_promise_amend_respond(
    p_idempotency_key,p_actor,p_promise_id,p_request_id,p_decision,
    p_surface,p_ip_hash,p_user_agent_hash
  );
end;
$$;

alter function public.lf_promise_detail(uuid,uuid) rename to lf_promise_detail_unfiltered;
create or replace function public.lf_promise_detail(p_actor uuid,p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_promise_detail_unfiltered(p_actor,p_promise_id);
end;
$$;

alter function public.lf_witness_detail(uuid,uuid) rename to lf_witness_detail_unfiltered;
create or replace function public.lf_witness_detail(p_actor uuid,p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if exists (
    select 1 from public.promises p where p.id=p_promise_id and p.activated_at is not null
  ) and not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_witness_detail_unfiltered(p_actor,p_promise_id);
end;
$$;

alter function public.lf_promise_fulfillment_detail(uuid,uuid)
  rename to lf_promise_fulfillment_detail_unfiltered;
create or replace function public.lf_promise_fulfillment_detail(p_actor uuid,p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_promise_fulfillment_detail_unfiltered(p_actor,p_promise_id);
end;
$$;

alter function public.lf_fulfillment_submit(
  uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface
) rename to lf_fulfillment_submit_unfiltered;
create or replace function public.lf_fulfillment_submit(
  p_idempotency_key uuid,p_actor uuid,p_promise_id uuid,
  p_answer public.fulfillment_answer,p_comment text,p_revise boolean,
  p_evidence_upload_ids uuid[],p_retained_evidence_ids uuid[],p_surface public.surface
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_fulfillment_submit_unfiltered(
    p_idempotency_key,p_actor,p_promise_id,p_answer,p_comment,p_revise,
    p_evidence_upload_ids,p_retained_evidence_ids,p_surface
  );
end;
$$;

alter function public.lf_fulfillment_reopen(uuid,uuid,uuid,public.surface)
  rename to lf_fulfillment_reopen_unfiltered;
create or replace function public.lf_fulfillment_reopen(
  p_idempotency_key uuid,p_actor uuid,p_promise_id uuid,p_surface public.surface
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_fulfillment_reopen_unfiltered(
    p_idempotency_key,p_actor,p_promise_id,p_surface
  );
end;
$$;

alter function public.lf_promise_amend_request(
  uuid,uuid,uuid,text,jsonb,text,public.surface,text,text
) rename to lf_promise_amend_request_unfiltered;
create or replace function public.lf_promise_amend_request(
  p_idempotency_key uuid,p_actor uuid,p_promise_id uuid,p_type text,p_proposed jsonb,
  p_reason text,p_surface public.surface,p_ip_hash text,p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_promise_amend_request_unfiltered(
    p_idempotency_key,p_actor,p_promise_id,p_type,p_proposed,p_reason,
    p_surface,p_ip_hash,p_user_agent_hash
  );
end;
$$;

alter function public.lf_promise_amend_respond(
  uuid,uuid,uuid,uuid,text,public.surface,text,text
) rename to lf_promise_amend_respond_unfiltered;
create or replace function public.lf_promise_amend_respond(
  p_idempotency_key uuid,p_actor uuid,p_promise_id uuid,p_request_id uuid,p_decision text,
  p_surface public.surface,p_ip_hash text,p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  return public.lf_promise_amend_respond_unfiltered(
    p_idempotency_key,p_actor,p_promise_id,p_request_id,p_decision,
    p_surface,p_ip_hash,p_user_agent_hash
  );
end;
$$;

alter function public.lf_promise_amend_withdraw(
  uuid,uuid,uuid,uuid,public.surface,text,text
) rename to lf_promise_amend_withdraw_unfiltered;
create or replace function public.lf_promise_amend_withdraw(
  p_idempotency_key uuid,p_actor uuid,p_promise_id uuid,p_request_id uuid,
  p_surface public.surface,p_ip_hash text,p_user_agent_hash text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cached jsonb; v_promise public.promises%rowtype;
  v_request public.amend_requests%rowtype; v_role public.participant_role;
  v_version public.promise_versions%rowtype; v_response jsonb;
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  select * into v_request from public.amend_requests
   where id=p_request_id and promise_id=p_promise_id;
  if v_request.type <> 'FINISH' then
    return public.lf_promise_amend_withdraw_unfiltered(
      p_idempotency_key,p_actor,p_promise_id,p_request_id,p_surface,p_ip_hash,p_user_agent_hash
    );
  end if;
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,p_actor,'promise-amend-withdraw'
  );
  if v_cached is not null then return v_cached; end if;
  select * into v_promise from public.promises where id=p_promise_id for update;
  select * into v_request from public.amend_requests
   where id=p_request_id and promise_id=p_promise_id and type='FINISH' and status='PENDING'
   for update;
  select pp.role into v_role from public.promise_participants pp
   where pp.promise_id=p_promise_id and pp.user_id=p_actor
     and pp.role in ('CREATOR','PARTNER') and pp.status='JOINED';
  if v_promise.id is null or v_request.id is null or v_role is null then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_promise.status <> 'AMEND_PENDING' or v_request.requester_id <> p_actor
     or v_request.expires_at <= now() then raise exception 'E_STATE_CONFLICT'; end if;
  select * into strict v_version from public.promise_versions
   where id=v_promise.current_version_id and activated_at is not null;
  update public.amend_requests set status='WITHDRAWN',responded_by=p_actor,responded_at=now()
   where id=p_request_id;
  update public.promises set status='ACTIVE',lock_version=lock_version+1,updated_at=now()
   where id=p_promise_id;
  insert into public.approvals (
    promise_id,version_id,user_id,role,action,content_hash,surface,ip_hash,user_agent_hash
  ) values (
    p_promise_id,v_version.id,p_actor,v_role,'FINISH_WITHDRAW',v_version.content_hash,
    p_surface,p_ip_hash,p_user_agent_hash
  );
  v_response:=pg_catalog.jsonb_build_object(
    'promise_id',p_promise_id,'status','ACTIVE','request_id',p_request_id,
    'request_status','WITHDRAWN'
  );
  perform public.lf_idempotency_finish(p_idempotency_key,v_response);
  return v_response;
end;
$$;

create or replace function public.lf_schedule_retention_worker()
returns void language plpgsql security definer set search_path = '' as $$
declare v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;
  for v_job_id in select jobid from cron.job where jobname='lf-retention-maintenance'
  loop perform cron.unschedule(v_job_id); end loop;
  perform cron.schedule('lf-retention-maintenance','17 * * * *',$command$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets
        where name='retention_maintenance_url' limit 1),
      headers := jsonb_build_object('Content-Type','application/json',
        'x-retention-worker-secret',(select decrypted_secret from vault.decrypted_secrets
          where name='retention_worker_secret' limit 1)),
      body := '{}'::jsonb, timeout_milliseconds := 30000
    );
  $command$);
end;
$$;

create or replace function public.lf_no_end_home_cards(
  p_actor uuid,
  p_after_id uuid,
  p_now timestamptz,
  p_limit int
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(candidate.card order by candidate.id),'[]'::jsonb)
  from (
    select p.id, pg_catalog.jsonb_build_object(
      'promise_id',p.id,'title',p.title,'status',p.status,'end_date',p.end_date,
      'updated_at',p.updated_at,'closed_at',p.closed_at,'my_role',actor_participant.role,
      'creator',pg_catalog.jsonb_build_object(
        'nickname',creator.nickname,'profile_image_url',creator.profile_image_url
      ),
      'partner',case when partner.user_id is null then null else pg_catalog.jsonb_build_object(
        'nickname',partner.nickname,'profile_image_url',partner.profile_image_url
      ) end,
      'has_witness',exists (
        select 1 from public.promise_participants witness
         where witness.promise_id=p.id and witness.role='WITNESS'
           and witness.status='JOINED' and witness.user_id is not null
      ),
      'needs_response',false
    ) card
    from public.promises p
    join public.promise_participants actor_participant
      on actor_participant.promise_id=p.id and actor_participant.user_id=p_actor
     and actor_participant.status='JOINED'
    join public.users creator on creator.id=p.creator_id
    left join lateral (
      select participant.user_id,partner_user.nickname,partner_user.profile_image_url
        from public.promise_participants participant
        join public.users partner_user on partner_user.id=participant.user_id
       where participant.promise_id=p.id and participant.role='PARTNER'
         and participant.status='JOINED' limit 1
    ) partner on true
    where p.status in ('ACTIVE','AMEND_PENDING') and p.end_date is null
      and (p_after_id is null or p.id>p_after_id) and not (p.hidden_by ? p_actor::text)
      and public.lf_has_record_access(p_actor,p.id,p_now)
    order by p.id limit p_limit
  ) candidate;
$$;

alter function public.lf_promise_home_list(uuid,text,jsonb,timestamptz)
  rename to lf_promise_home_list_unfiltered;

create or replace function public.lf_promise_home_list(
  p_actor uuid,
  p_tab text,
  p_cursor jsonb default null,
  p_now timestamptz default now()
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page jsonb;
  v_items jsonb;
  v_pinned jsonb;
  v_counts jsonb;
  v_cursor jsonb := p_cursor;
  v_next jsonb;
  v_last jsonb;
  v_raw_items jsonb;
  v_append_items jsonb;
  v_remaining int;
  v_attempts int := 0;
  v_finite_done boolean := false;
  v_history boolean := p_tab in ('DONE','BROKEN','UNSETTLED','DECLINED');
begin
  if p_tab='ACTIVE' and p_cursor is not null and p_cursor->'end_date'='null'::jsonb then
    v_page := public.lf_promise_home_list_unfiltered(p_actor,p_tab,p_cursor,p_now);
    v_raw_items:=public.lf_no_end_home_cards(
      p_actor,(p_cursor->>'promise_id')::uuid,p_now,21
    );
    select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb)
      into v_items
      from pg_catalog.jsonb_array_elements(v_raw_items) with ordinality entry(value,ordinality)
     where entry.ordinality<=20;
    if pg_catalog.jsonb_array_length(v_raw_items)>20 then
      v_last:=v_items->19;
      v_next:=pg_catalog.jsonb_build_object(
        'tab','ACTIVE','status_rank',1,'end_date',null,'promise_id',v_last->>'promise_id'
      );
    else v_next:=null; end if;
  else
    loop
      v_page := public.lf_promise_home_list_unfiltered(p_actor,p_tab,v_cursor,p_now);
      -- ACTIVE 탭의 종료일 없는 행은 원본 목록에도 nulls last 로 섞여 나온다. 그 행은 아래에서
      -- lf_no_end_home_cards 가 덧붙이므로 여기서 빼지 않으면 같은 카드가 두 번 뜬다.
      select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb)
        into v_items
        from pg_catalog.jsonb_array_elements(v_page->'items') with ordinality entry(value,ordinality)
       where public.lf_has_record_access(p_actor,(entry.value->>'promise_id')::uuid,p_now)
         and not (p_tab='ACTIVE' and entry.value->'end_date'='null'::jsonb);
      v_next := v_page->'next_cursor';
      -- 원본 페이지에 종료일 없는 행이 나타났다면 종료일 있는 행은 다 소진된 것이다(nulls last).
      v_finite_done := p_tab='ACTIVE' and (v_next is null or v_next='null'::jsonb or exists (
        select 1 from pg_catalog.jsonb_array_elements(v_page->'items') entry
         where entry.value->'end_date'='null'::jsonb
      ));
      v_attempts := v_attempts + 1;
      exit when pg_catalog.jsonb_array_length(v_items)>0 or v_next is null
        or v_next='null'::jsonb or v_finite_done or v_attempts>=100;
      v_cursor := v_next;
    end loop;
    if v_finite_done then
      v_remaining:=20-pg_catalog.jsonb_array_length(v_items);
      v_raw_items:=public.lf_no_end_home_cards(p_actor,null,p_now,v_remaining+1);
      select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb)
        into v_append_items
        from pg_catalog.jsonb_array_elements(v_raw_items) with ordinality entry(value,ordinality)
       where entry.ordinality<=v_remaining;
      v_items:=v_items||v_append_items;
      if pg_catalog.jsonb_array_length(v_raw_items)>v_remaining then
        v_last:=v_items->(pg_catalog.jsonb_array_length(v_items)-1);
        v_next:=pg_catalog.jsonb_build_object(
          'tab','ACTIVE','status_rank',1,'end_date',v_last->'end_date',
          'promise_id',v_last->>'promise_id'
        );
      else
        v_next:=null;
      end if;
    end if;
  end if;

  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb)
    into v_pinned
    from pg_catalog.jsonb_array_elements(v_page->'pinned') with ordinality entry(value,ordinality)
   where public.lf_has_record_access(p_actor,(entry.value->>'promise_id')::uuid,p_now);

  select case when v_history then pg_catalog.jsonb_build_object(
      'DONE', count(*) filter (where p.status='COMPLETED'),
      'BROKEN', count(*) filter (where p.status='BROKEN'),
      'UNSETTLED', count(*) filter (where p.status in ('DISPUTED','UNRESOLVED')),
      'DECLINED', count(*) filter (where p.status in ('DECLINED','CANCELED'))
    ) else pg_catalog.jsonb_build_object(
      'ACTIVE', count(*) filter (where p.status in ('ACTIVE','AMEND_PENDING','CHECKING')),
      'WAITING', count(*) filter (where p.status in ('DRAFT','PENDING')),
      'COMPLETED', count(*) filter (where p.status in (
        'COMPLETED','BROKEN','DISPUTED','UNRESOLVED','DECLINED','CANCELED'
      ))
    ) end into v_counts
    from public.promises p
    join public.promise_participants actor_participant
      on actor_participant.promise_id=p.id and actor_participant.user_id=p_actor
     and actor_participant.status='JOINED'
   where p.status in (
      'DRAFT','PENDING','ACTIVE','AMEND_PENDING','CHECKING','COMPLETED','BROKEN',
      'DISPUTED','UNRESOLVED','DECLINED','CANCELED'
    )
     and not (p.hidden_by ? p_actor::text)
     and (p.status not in ('DRAFT','PENDING') or (
       p.creator_id=p_actor and actor_participant.role='CREATOR'
     ))
     and public.lf_has_record_access(p_actor,p.id,p_now);

  if v_next <> 'null'::jsonb and pg_catalog.jsonb_array_length(v_items) > 0 then
    v_last := v_items->(pg_catalog.jsonb_array_length(v_items)-1);
    v_next := case
      when p_tab='ACTIVE' then pg_catalog.jsonb_build_object(
        'tab','ACTIVE','status_rank',case when v_last->>'status'='CHECKING' then 0 else 1 end,
        'end_date',v_last->'end_date','promise_id',v_last->>'promise_id'
      )
      when p_tab='WAITING' then pg_catalog.jsonb_build_object(
        'tab','WAITING','updated_at',v_last->>'updated_at','promise_id',v_last->>'promise_id'
      )
      else pg_catalog.jsonb_build_object(
        'tab',p_tab,'closed_at',v_last->'closed_at','updated_at',v_last->>'updated_at',
        'promise_id',v_last->>'promise_id'
      )
    end;
  end if;

  return pg_catalog.jsonb_build_object(
    'items',v_items,'pinned',v_pinned,'counts',v_counts,'next_cursor',v_next
  );
end;
$$;

alter function public.lf_participant_promise_list(uuid)
  rename to lf_participant_promise_list_unfiltered;

create or replace function public.lf_participant_promise_list(p_actor uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb)
    from pg_catalog.jsonb_array_elements(
      public.lf_participant_promise_list_unfiltered(p_actor)
    ) with ordinality entry(value,ordinality)
   where public.lf_has_record_access(p_actor,(entry.value->>'promise_id')::uuid,now());
$$;

-- ── 증빙 365일 보존(J-08) 폐지 — PO 2026-08-29 ──────────────────────────────
-- 증빙 사진은 두 경우에만 사라진다. 기록과 함께(보존 만료 정리: lf_purge_job_claim 이 storage_key
-- 를 내고 lf_purge_job_finalize 가 행을 지운다) 또는 사용자가 직접 뺄 때(removed_at). 영구보존
-- 참여자가 있는 기록의 사진은 어떤 경로로도 지우지 않는다. 종결 +365일 기한은 그 원칙과 정면으로
-- 충돌하므로 기한을 매기는 트리거, 기한을 읽는 정리 대상, 이미 매겨진 기한 셋 다 물린다.
drop trigger if exists fulfillment_evidence_retention on public.promises;
drop function if exists public.lf_set_terminal_evidence_retention();

-- 정리 대상 함수만 고치면 남아 있는 기한은 무해하지만, 열을 읽는 코드가 되살아나는 순간 그 사진이
-- 예고 없이 사라진다. 매겨진 기한을 지워 열을 실제로 비운다.
update public.fulfillment_evidences set purge_after = null
 where purged_at is null and removed_at is null;
comment on column public.fulfillment_evidences.purge_after is
  'legacy — 종결 +365일 보존(J-08)은 2026-08-29 에 폐지됐다. 어떤 경로도 읽거나 쓰지 않으며 열만 남긴다.';

-- J-08 주간 잡(lf-evidence-purge)은 남는다 — 사용자가 뺀 사진의 Storage 객체는 여전히 이 경로로만
-- 지워진다. 기한 경과 조건만 빠진다.
create or replace function public.lf_evidence_purge_targets(
  p_now   timestamptz default now(),
  p_limit int default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'evidences', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'evidence_id', targets.id,
                   'bucket_id', 'fulfillment-evidences',
                   'storage_key', targets.storage_key,
                   'thumb_key', targets.thumb_key
                 )
                 order by targets.id
               )
          from (
            select fe.id, fe.storage_key, fe.thumb_key
              from public.fulfillment_evidences fe
             where fe.purged_at is null
               and fe.removed_at is not null
             order by fe.id
             limit greatest(p_limit, 0)
          ) targets
      ),
      '[]'::jsonb
    ),
    'uploads', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'upload_id', targets.id,
                   'bucket_id', 'fulfillment-evidences',
                   'storage_key', targets.storage_key,
                   'thumb_key', targets.thumb_key
                 )
                 order by targets.id
               )
          from (
            select eu.id, eu.storage_key, eu.thumb_key
              from public.evidence_uploads eu
             where eu.status in ('PENDING', 'READY', 'DISCARDED', 'FAILED')
               and (
                 eu.status in ('DISCARDED', 'FAILED')
                 or eu.expires_at < p_now
               )
             order by eu.id
             limit greatest(p_limit, 0)
          ) targets
      ),
      '[]'::jsonb
    )
  );
$$;
revoke all on function public.lf_evidence_purge_targets(timestamptz, int)
  from public, anon, authenticated;
grant execute on function public.lf_evidence_purge_targets(timestamptz, int) to service_role;

-- 종결 시 purge_after 를 매기던 두 번째 자리. 20260817100453 의 본문을 그대로 옮기고 그 갱신문과
-- c_retention_days 만 뺐다 — 기한을 매기는 코드가 하나라도 남으면 '폐지'가 아니다.
create or replace function public.lf_fulfillment_submit_unfiltered(
  p_idempotency_key     uuid,
  p_actor               uuid,
  p_promise_id          uuid,
  p_answer              public.fulfillment_answer,
  p_comment             text,
  p_revise              boolean,
  p_evidence_upload_ids uuid[],
  p_retained_evidence_ids uuid[],
  p_surface             public.surface
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_comment_max constant int := 200;
  c_evidence_max constant int := 3;
  v_cached             jsonb;
  v_promise            public.promises%rowtype;
  v_actor_role         public.participant_role;
  v_actor_nickname     text;
  v_actor_check_id     uuid;
  v_actor_submitted    timestamptz;
  v_actor_revised      timestamptz;
  v_other_check_id     uuid;
  v_other_answer       public.fulfillment_answer;
  v_comment            text := nullif(public.lf_normalize_input(p_comment), '');
  v_upload_ids         uuid[] := coalesce(p_evidence_upload_ids, '{}'::uuid[]);
  v_retained_ids       uuid[] := coalesce(p_retained_evidence_ids, '{}'::uuid[]);
  v_expected           int;
  v_actual             int;
  v_result             public.promise_status := 'CHECKING';
  v_keep_rates_before  jsonb := '{}'::jsonb;
  v_response           jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_actor, 'fulfillment-submit'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select *
    into v_promise
    from public.promises
   where id = p_promise_id
     for update;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  select pp.role, u.nickname
    into v_actor_role, v_actor_nickname
    from public.promise_participants pp
    join public.users u on u.id = pp.user_id
   where pp.promise_id = p_promise_id
     and pp.user_id = p_actor
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED';

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_promise.status <> 'CHECKING'
     or v_promise.check_deadline_at is null
     or v_promise.check_deadline_at <= now() then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if char_length(coalesce(v_comment, '')) > c_comment_max then
    raise exception 'E_VALIDATION';
  end if;

  if cardinality(v_upload_ids) > c_evidence_max
     or cardinality(v_retained_ids) > c_evidence_max
     or cardinality(v_upload_ids) + cardinality(v_retained_ids) > c_evidence_max then
    raise exception 'E_VALIDATION';
  end if;

  select count(distinct value)::int
    into v_actual
    from unnest(v_upload_ids || v_retained_ids) value;
  if v_actual <> cardinality(v_upload_ids) + cardinality(v_retained_ids) then
    raise exception 'E_VALIDATION';
  end if;

  select fc.id, fc.submitted_at, fc.revised_at
    into v_actor_check_id, v_actor_submitted, v_actor_revised
    from public.fulfillment_checks fc
   where fc.promise_id = p_promise_id
     and fc.user_id = p_actor
     and fc.round_no = v_promise.check_round_no;

  select fc.id, fc.answer
    into v_other_check_id, v_other_answer
    from public.fulfillment_checks fc
    join public.promise_participants pp
      on pp.promise_id = fc.promise_id
     and pp.user_id = fc.user_id
     and pp.role in ('CREATOR', 'PARTNER')
     and pp.status = 'JOINED'
   where fc.promise_id = p_promise_id
     and fc.user_id <> p_actor
     and fc.round_no = v_promise.check_round_no;

  if v_actor_check_id is null then
    if coalesce(p_revise, false) or cardinality(v_retained_ids) > 0 then
      raise exception 'E_STATE_CONFLICT';
    end if;
  else
    if not coalesce(p_revise, false)
       or v_actor_revised is not null
       or v_other_check_id is not null then
      raise exception 'E_STATE_CONFLICT';
    end if;

    select count(*)::int
      into v_actual
      from public.fulfillment_evidences fe
     where fe.id = any(v_retained_ids)
       and fe.check_id = v_actor_check_id
       and fe.promise_id = p_promise_id
       and fe.uploaded_by = p_actor
       and fe.removed_at is null
       and fe.purged_at is null;
    if v_actual <> cardinality(v_retained_ids) then
      raise exception 'E_STATE_CONFLICT';
    end if;
  end if;

  v_expected := cardinality(v_upload_ids);
  select count(*)::int
    into v_actual
    from public.evidence_uploads eu
   where eu.id = any(v_upload_ids)
     and eu.promise_id = p_promise_id
     and eu.round_no = v_promise.check_round_no
     and eu.uploaded_by = p_actor
     and eu.status = 'READY';
  if v_actual <> v_expected then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_actor_check_id is null then
    insert into public.fulfillment_checks (
      promise_id, version_id, user_id, round_no, answer, comment, surface
    )
    values (
      p_promise_id, v_promise.current_version_id, p_actor, v_promise.check_round_no,
      p_answer, v_comment, p_surface
    )
    returning id, submitted_at, revised_at
      into v_actor_check_id, v_actor_submitted, v_actor_revised;
  else
    update public.fulfillment_checks
       set answer = p_answer,
           comment = v_comment,
           surface = p_surface,
           revised_at = now()
     where id = v_actor_check_id
       and revised_at is null
    returning submitted_at, revised_at
      into v_actor_submitted, v_actor_revised;

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;

    update public.fulfillment_evidences
       set removed_at = now()
     where check_id = v_actor_check_id
       and removed_at is null
       and not (id = any(v_retained_ids));
  end if;

  insert into public.fulfillment_evidences (
    upload_id,
    check_id,
    promise_id,
    uploaded_by,
    storage_key,
    thumb_key,
    mime,
    bytes,
    width,
    height
  )
  select eu.id,
         v_actor_check_id,
         eu.promise_id,
         eu.uploaded_by,
         eu.storage_key,
         eu.thumb_key,
         eu.mime,
         eu.bytes,
         eu.width,
         eu.height
    from public.evidence_uploads eu
   where eu.id = any(v_upload_ids);

  update public.evidence_uploads
     set status = 'BOUND',
         bound_at = now(),
         updated_at = now()
   where id = any(v_upload_ids)
     and status = 'READY';
  get diagnostics v_actual = row_count;
  if v_actual <> v_expected then
    raise exception 'E_STATE_CONFLICT';
  end if;

  if v_other_check_id is not null then
    if p_answer = 'KEPT' and v_other_answer = 'KEPT' then
      v_result := 'COMPLETED';
    elsif p_answer = 'NOT_KEPT' and v_other_answer = 'NOT_KEPT' then
      v_result := 'BROKEN';
    else
      v_result := 'DISPUTED';
    end if;

    update public.promises
       set status = v_result,
           closed_at = case when v_result in ('COMPLETED', 'BROKEN') then now() else null end,
           lock_version = lock_version + 1,
           updated_at = now()
     where id = p_promise_id
       and status = 'CHECKING';

    if not found then
      raise exception 'E_STATE_CONFLICT';
    end if;

    if v_result in ('COMPLETED', 'BROKEN') then
      update public.reminder_schedules
         set status = 'CANCELED'
       where promise_id = p_promise_id
         and status = 'PENDING';
    end if;

    if v_result = 'COMPLETED' then
      select coalesce(
               jsonb_object_agg(pp.user_id::text, to_jsonb(tp.keep_rate)),
               '{}'::jsonb
             )
        into v_keep_rates_before
        from public.promise_participants pp
        left join public.trust_profiles tp on tp.user_id = pp.user_id
       where pp.promise_id = p_promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED';
    end if;

    perform public.lf_recompute_promise_trust_profiles(p_promise_id);

    if v_result = 'COMPLETED' then
      insert into public.completion_celebrations (
        promise_id, user_id, participant_role, keep_rate_before, keep_rate_after
      )
      select p_promise_id,
             pp.user_id,
             pp.role,
             (v_keep_rates_before ->> pp.user_id::text)::int,
             tp.keep_rate
        from public.promise_participants pp
        left join public.trust_profiles tp on tp.user_id = pp.user_id
       where pp.promise_id = p_promise_id
         and pp.role in ('CREATOR', 'PARTNER')
         and pp.status = 'JOINED'
      on conflict (promise_id, user_id) do nothing;

      insert into public.daily_metrics (date, completed_count)
      values ((now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (date) do update
        set completed_count = public.daily_metrics.completed_count + 1,
            updated_at = now();
    end if;
  end if;

  select jsonb_build_object(
           'promise_id', p_promise_id,
           'status', v_result,
           'round_no', v_promise.check_round_no,
           'submitted_at', v_actor_submitted,
           'revised_at', v_actor_revised,
           'waiting_for_partner', v_other_check_id is null,
           'title', v_promise.title,
           'actor_nickname', v_actor_nickname,
           'notification_recipients', coalesce(
             jsonb_agg(
               jsonb_build_object('user_id', pp.user_id, 'role', pp.role)
               order by case pp.role when 'CREATOR' then 1 when 'PARTNER' then 2 else 3 end,
                        pp.id
             ) filter (where pp.user_id is not null),
             '[]'::jsonb
           )
         )
    into v_response
    from public.promise_participants pp
   where pp.promise_id = p_promise_id
     and pp.status = 'JOINED';

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_witness_max(), public.lf_witness_creator_free(),
  public.lf_end_date_free_days(), public.lf_extension_days(),
  public.lf_retention_free_days(), public.lf_retention_warning_days(),
  public.lf_reward_intent_ttl_minutes(), public.lf_permanent_access_product_id(),
  public.lf_rewarded_ads_enabled() from public, anon, authenticated;
revoke all on function public.lf_no_end_home_cards(uuid,uuid,timestamptz,int)
  from public, anon, authenticated;
revoke all on function public.lf_permanent_access_effective(uuid,uuid),
  public.lf_reward_grant_count(uuid,uuid,text), public.lf_retention_anchor_of(uuid),
  public.lf_access_expires_at(uuid,uuid), public.lf_duration_ceiling_date(uuid),
  public.lf_reward_action_allowed(uuid,uuid,text), public.lf_witness_used(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.lf_has_record_access(uuid,uuid,timestamptz),
  public.lf_promise_entitlements(uuid,uuid), public.lf_reward_intent_create(uuid,uuid,text),
  public.lf_reward_grant(uuid,text,text,text,text,timestamptz),
  public.lf_reward_status(uuid,uuid),
  public.lf_permanent_access_grant(uuid,uuid,text,text,text,timestamptz),
  public.lf_retention_maintenance(timestamptz), public.lf_purge_job_claim(timestamptz,int),
  public.lf_purge_job_finalize(uuid,uuid,timestamptz),
  public.lf_promise_finish_request(uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_finish_respond(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_respond_v2(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_schedule_retention_worker(),
  public.lf_promise_home_list_unfiltered(uuid,text,jsonb,timestamptz),
  public.lf_promise_home_list(uuid,text,jsonb,timestamptz),
  public.lf_participant_promise_list_unfiltered(uuid),
  public.lf_participant_promise_list(uuid),
  public.lf_promise_detail_unfiltered(uuid,uuid),public.lf_promise_detail(uuid,uuid),
  public.lf_witness_detail_unfiltered(uuid,uuid),public.lf_witness_detail(uuid,uuid),
  public.lf_promise_fulfillment_detail_unfiltered(uuid,uuid),
  public.lf_promise_fulfillment_detail(uuid,uuid),
  public.lf_fulfillment_submit_unfiltered(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface),
  public.lf_fulfillment_submit(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface),
  public.lf_fulfillment_reopen_unfiltered(uuid,uuid,uuid,public.surface),
  public.lf_fulfillment_reopen(uuid,uuid,uuid,public.surface),
  public.lf_promise_amend_request_unfiltered(uuid,uuid,uuid,text,jsonb,text,public.surface,text,text),
  public.lf_promise_amend_request(uuid,uuid,uuid,text,jsonb,text,public.surface,text,text),
  public.lf_promise_amend_respond_unfiltered(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_respond(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_withdraw_unfiltered(uuid,uuid,uuid,uuid,public.surface,text,text),
  public.lf_promise_amend_withdraw(uuid,uuid,uuid,uuid,public.surface,text,text)
  from public, anon, authenticated;
grant execute on function public.lf_witness_max(), public.lf_witness_creator_free(),
  public.lf_end_date_free_days(), public.lf_extension_days(),
  public.lf_retention_free_days(), public.lf_retention_warning_days(),
  public.lf_reward_intent_ttl_minutes(), public.lf_permanent_access_product_id(),
  public.lf_rewarded_ads_enabled(),
  public.lf_no_end_home_cards(uuid,uuid,timestamptz,int),
  public.lf_permanent_access_effective(uuid,uuid),
  public.lf_reward_grant_count(uuid,uuid,text), public.lf_retention_anchor_of(uuid),
  public.lf_access_expires_at(uuid,uuid), public.lf_duration_ceiling_date(uuid),
  public.lf_reward_action_allowed(uuid,uuid,text), public.lf_witness_used(uuid,uuid),
  public.lf_has_record_access(uuid,uuid,timestamptz)
  to service_role;
grant execute on function public.lf_promise_entitlements(uuid,uuid),
  public.lf_reward_intent_create(uuid,uuid,text),
  public.lf_reward_status(uuid,uuid),
  public.lf_reward_grant(uuid,text,text,text,text,timestamptz),
  public.lf_permanent_access_grant(uuid,uuid,text,text,text,timestamptz),
  public.lf_retention_maintenance(timestamptz), public.lf_purge_job_claim(timestamptz,int),
  public.lf_purge_job_finalize(uuid,uuid,timestamptz),
  public.lf_promise_finish_request(uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_finish_respond(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_respond_v2(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_schedule_retention_worker(),
  public.lf_promise_home_list_unfiltered(uuid,text,jsonb,timestamptz),
  public.lf_promise_home_list(uuid,text,jsonb,timestamptz),
  public.lf_participant_promise_list_unfiltered(uuid),
  public.lf_participant_promise_list(uuid),
  public.lf_promise_detail_unfiltered(uuid,uuid),public.lf_promise_detail(uuid,uuid),
  public.lf_witness_detail_unfiltered(uuid,uuid),public.lf_witness_detail(uuid,uuid),
  public.lf_promise_fulfillment_detail_unfiltered(uuid,uuid),
  public.lf_promise_fulfillment_detail(uuid,uuid),
  public.lf_fulfillment_submit_unfiltered(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface),
  public.lf_fulfillment_submit(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface),
  public.lf_fulfillment_reopen_unfiltered(uuid,uuid,uuid,public.surface),
  public.lf_fulfillment_reopen(uuid,uuid,uuid,public.surface),
  public.lf_promise_amend_request_unfiltered(uuid,uuid,uuid,text,jsonb,text,public.surface,text,text),
  public.lf_promise_amend_request(uuid,uuid,uuid,text,jsonb,text,public.surface,text,text),
  public.lf_promise_amend_respond_unfiltered(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_respond(uuid,uuid,uuid,uuid,text,public.surface,text,text),
  public.lf_promise_amend_withdraw_unfiltered(uuid,uuid,uuid,uuid,public.surface,text,text),
  public.lf_promise_amend_withdraw(uuid,uuid,uuid,uuid,public.surface,text,text)
  to service_role;

-- 증인 목록(creator/partner capacity)·홈 목록(종료일 없는 카드)·상세(entitlements)의 응답
-- 모양이 이 마이그레이션과 함께 바뀐다. 이전 빌드는 그 응답을 파싱하지 못하므로 최소 버전을
-- 올려 강제 업데이트 화면으로 보낸다.
update public.app_configs set value = pg_catalog.to_jsonb('0.2.0'::text)
 where key = 'min_app_version';

select public.lf_schedule_retention_worker();
