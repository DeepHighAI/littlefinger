-- Google Play 취소 구매 회수 + Auth 사용자 삭제 재시도.
--
-- 두 작업 모두 외부 시스템 호출이 DB 트랜잭션과 원자적일 수 없어서 append-only/queue 경계를
-- 먼저 커밋하고, 내부 Edge worker가 멱등하게 외부 작업을 수렴시킨다.

-- ============================================================
-- 1) 취소 구매 원장 — 구매 행은 보존하고 권리만 회수한다
-- ============================================================

-- server-only: slot_purchase_revocations
create table public.slot_purchase_revocations (
  purchase_id uuid primary key references public.slot_purchases (id),
  voided_at timestamptz not null,
  voided_source int not null,
  voided_reason int not null,
  discovered_at timestamptz not null default now()
);

alter table public.slot_purchase_revocations enable row level security;
revoke all on table public.slot_purchase_revocations from public, anon, authenticated, service_role;

create or replace function public.lf_slot_revoke(
  p_purchase_token text,
  p_voided_at timestamptz,
  p_voided_source int,
  p_voided_reason int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
begin
  select sp.id into v_purchase_id
    from public.slot_purchases sp
   where sp.purchase_token = p_purchase_token;

  -- 다른 앱·환경의 토큰은 이 프로젝트의 권리를 바꾸지 않는다.
  if not found then return false; end if;

  insert into public.slot_purchase_revocations
    (purchase_id, voided_at, voided_source, voided_reason)
  values
    (v_purchase_id, p_voided_at, p_voided_source, p_voided_reason)
  on conflict (purchase_id) do nothing;

  return found;
end;
$$;

create or replace function public.lf_slot_capacity(p_user_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select public.lf_free_promise_slots()
       + coalesce((
           select sum(sp.granted_slots)::int
             from public.slot_purchases sp
            where sp.user_id = p_user_id
              and not exists (
                select 1
                  from public.slot_purchase_revocations spr
                 where spr.purchase_id = sp.id
              )
         ), 0);
$$;

comment on table public.slot_purchase_revocations is
  'Play Voided Purchases 대사로 확인한 슬롯 권리 회수 원장. 구매 감사 행은 삭제하지 않는다.';
comment on function public.lf_slot_revoke is
  'purchase-reconcile 전용 멱등 회수. 이 프로젝트에 없는 토큰은 false다.';

-- ============================================================
-- 2) Auth 삭제 outbox — public 탈퇴 커밋과 같은 트랜잭션에서 생성한다
-- ============================================================

-- server-only: auth_deletion_outbox
create table public.auth_deletion_outbox (
  user_id uuid primary key references public.users (id),
  status text not null default 'PENDING' check (status in ('PENDING', 'LEASED', 'PROCESSED')),
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  check ((status = 'LEASED') = (lease_id is not null and lease_expires_at is not null)),
  check ((status = 'PROCESSED') = (processed_at is not null))
);

create index auth_deletion_outbox_due_idx
  on public.auth_deletion_outbox (next_attempt_at, created_at)
  where status in ('PENDING', 'LEASED');

alter table public.auth_deletion_outbox enable row level security;
revoke all on table public.auth_deletion_outbox from public, anon, authenticated, service_role;

create or replace function public.lf_enqueue_auth_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auth_deletion_outbox (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger users_enqueue_auth_deletion
after update of status on public.users
for each row
when (new.status = 'WITHDRAWN' and old.status is distinct from new.status)
execute function public.lf_enqueue_auth_deletion();

-- 배포 전에 public 탈퇴만 끝난 계정도 복구 대상에 넣는다.
insert into public.auth_deletion_outbox (user_id)
select u.id
  from public.users u
  join auth.users au on au.id = u.id
 where u.status = 'WITHDRAWN'
on conflict (user_id) do nothing;

create or replace function public.lf_auth_deletion_claim(
  p_now timestamptz,
  p_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'E_VALIDATION'; end if;

  with candidates as (
    select ado.user_id
      from public.auth_deletion_outbox ado
     where (
       (ado.status = 'PENDING' and ado.next_attempt_at <= p_now)
       or (ado.status = 'LEASED' and ado.lease_expires_at <= p_now)
     )
     order by ado.next_attempt_at, ado.created_at
     for update skip locked
     limit p_limit
  ), claimed as (
    update public.auth_deletion_outbox ado
       set status = 'LEASED',
           lease_id = gen_random_uuid(),
           lease_expires_at = p_now + interval '5 minutes',
           updated_at = p_now
      from candidates c
     where ado.user_id = c.user_id
    returning ado.user_id, ado.lease_id
  )
  select pg_catalog.jsonb_build_object(
    'items', coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('user_id', c.user_id, 'lease_id', c.lease_id)
      ),
      '[]'::jsonb
    )
  ) into v_result
  from claimed c;

  return v_result;
end;
$$;

create or replace function public.lf_auth_deletion_complete(
  p_user_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auth_deletion_outbox
     set status = 'PROCESSED', lease_id = null, lease_expires_at = null,
         processed_at = now(), updated_at = now(), last_error = null
   where user_id = p_user_id
     and status = 'LEASED'
     and lease_id = p_lease_id;
  return found;
end;
$$;

create or replace function public.lf_auth_deletion_complete_immediate(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auth_deletion_outbox
     set status = 'PROCESSED', lease_id = null, lease_expires_at = null,
         processed_at = now(), updated_at = now(), last_error = null
   where user_id = p_user_id
     and status <> 'PROCESSED';
  return found;
end;
$$;

create or replace function public.lf_auth_deletion_retry(
  p_user_id uuid,
  p_lease_id uuid,
  p_error text,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt int;
begin
  update public.auth_deletion_outbox
     set status = 'PENDING',
         attempt_count = attempt_count + 1,
         next_attempt_at = p_now + make_interval(
           secs => least(86400, (power(2::numeric, least(attempt_count, 16)) * 60)::int)
         ),
         lease_id = null,
         lease_expires_at = null,
         last_error = left(coalesce(p_error, 'UNKNOWN'), 500),
         updated_at = p_now
   where user_id = p_user_id
     and status = 'LEASED'
     and lease_id = p_lease_id
  returning attempt_count into v_attempt;
  return found;
end;
$$;

comment on table public.auth_deletion_outbox is
  'public 탈퇴 뒤 auth.users 삭제를 완료할 때까지 무기한 재시도하는 서버 전용 outbox.';

-- ============================================================
-- 3) 내부 worker 스케줄 — URL·공유 비밀은 Vault가 정본이다
-- ============================================================

create or replace function public.lf_schedule_reconciliation_workers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;

  for v_job_id in
    select jobid from cron.job
     where jobname in ('lf-purchase-reconcile', 'lf-account-delete-retry')
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'lf-purchase-reconcile',
    '17 3 * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets
                 where name = 'purchase_reconcile_url' limit 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-purchase-reconcile-secret',
          (select decrypted_secret from vault.decrypted_secrets
            where name = 'purchase_reconcile_secret' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $command$
  );

  perform cron.schedule(
    'lf-account-delete-retry',
    '*/15 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets
                 where name = 'account_delete_retry_url' limit 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-account-delete-retry-secret',
          (select decrypted_secret from vault.decrypted_secrets
            where name = 'account_delete_retry_secret' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $command$
  );
end;
$$;

revoke all on function public.lf_slot_revoke(text, timestamptz, int, int)
  from public, anon, authenticated;
revoke all on function public.lf_slot_capacity(uuid) from public, anon, authenticated;
revoke all on function public.lf_enqueue_auth_deletion()
  from public, anon, authenticated, service_role;
revoke all on function public.lf_auth_deletion_claim(timestamptz, int)
  from public, anon, authenticated;
revoke all on function public.lf_auth_deletion_complete(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.lf_auth_deletion_complete_immediate(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_auth_deletion_retry(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.lf_schedule_reconciliation_workers()
  from public, anon, authenticated;

grant execute on function public.lf_slot_revoke(text, timestamptz, int, int) to service_role;
grant execute on function public.lf_slot_capacity(uuid) to service_role;
grant execute on function public.lf_auth_deletion_claim(timestamptz, int) to service_role;
grant execute on function public.lf_auth_deletion_complete(uuid, uuid) to service_role;
grant execute on function public.lf_auth_deletion_complete_immediate(uuid) to service_role;
grant execute on function public.lf_auth_deletion_retry(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.lf_schedule_reconciliation_workers() to service_role;

select public.lf_schedule_reconciliation_workers();
