-- F-01 계정 생명주기 · S-5 숨기기 · §9 신고/차단.

-- auth 계정을 지워도 상대방이 보는 확정 기록의 사용자 FK는 남아야 한다.
alter table public.users drop constraint if exists users_id_fkey;

-- 닉네임은 서버 API에서만 갱신한다. 클라이언트의 users 전체 행 UPDATE 권한은
-- status·email_verified까지 바꿀 수 있어 최소 권한 원칙에 맞지 않는다.
drop policy if exists "users update own" on public.users;
revoke update on public.users from anon, authenticated;
revoke insert on public.blocks, public.reports from anon, authenticated;

create or replace function public.lf_is_active_actor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'ACTIVE'
  )
$$;

-- WITHDRAWN이 된 뒤 기존 JWT가 잠시 살아 있어도 어느 RLS 행에도 접근하지 못한다.
create policy "active account boundary" on public.users
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.device_tokens
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.promises
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.promise_versions
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.promise_participants
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.approvals
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.invitations
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.fulfillment_checks
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.fulfillment_evidences
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.amend_requests
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.notifications
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.trust_profiles
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.blocks
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.reports
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());
create policy "active account boundary" on public.terms_agreements
  as restrictive for all using (public.lf_is_active_actor())
  with check (public.lf_is_active_actor());

create or replace function public.lf_account_withdraw(
  p_idempotency_key uuid,
  p_actor uuid,
  p_anonymized_kakao_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.user_status;
  v_affected uuid[];
  v_cached jsonb;
  v_response jsonb;
begin
  if p_anonymized_kakao_id !~ '^withdrawn:[0-9a-f]{64}$' then
    raise exception 'E_VALIDATION';
  end if;

  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'account-withdraw');
  if v_cached is not null then return v_cached; end if;

  select u.status into v_status
  from public.users u
  where u.id = p_actor
  for update;

  if not found then raise exception 'E_AUTH_REQUIRED'; end if;
  if v_status = 'WITHDRAWN' then
    v_response := jsonb_build_object('status', 'WITHDRAWN');
    perform public.lf_idempotency_finish(p_idempotency_key, v_response);
    return v_response;
  end if;
  if v_status <> 'ACTIVE' then raise exception 'E_FORBIDDEN'; end if;

  -- 확정 전 개인 초안만 삭제한다. 확정 뒤 기록은 어느 경로에서도 지우지 않는다.
  delete from public.promises p
  where p.creator_id = p_actor and p.status = 'DRAFT';

  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into v_affected
  from public.promises p
  where p.status = 'PENDING'
    and (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants pp
        where pp.promise_id = p.id and pp.user_id = p_actor
          and pp.status in ('INVITED', 'JOINED')
      )
    );

  update public.invitations i
     set status = 'REVOKED'
   where i.promise_id = any(v_affected) and i.status = 'PENDING';
  update public.reminder_schedules rs
     set status = 'CANCELED'
   where rs.promise_id = any(v_affected) and rs.status = 'PENDING';
  update public.promises p
     set status = 'DECLINED', closed_at = now(), updated_at = now(),
         lock_version = p.lock_version + 1
   where p.id = any(v_affected) and p.status = 'PENDING';

  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into v_affected
  from public.promises p
  where p.status = 'AMEND_PENDING'
    and (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants pp
        where pp.promise_id = p.id and pp.user_id = p_actor and pp.status = 'JOINED'
      )
    );

  update public.amend_requests ar
     set status = 'WITHDRAWN', responded_by = p_actor, responded_at = now()
   where ar.promise_id = any(v_affected) and ar.status = 'PENDING';
  update public.reminder_schedules rs
     set status = 'CANCELED'
   where rs.promise_id = any(v_affected) and rs.status = 'PENDING'
     and rs.kind = 'AMEND_REMIND';
  update public.promises p
     set status = 'ACTIVE', updated_at = now(), lock_version = p.lock_version + 1
   where p.id = any(v_affected) and p.status = 'AMEND_PENDING';

  delete from public.device_tokens where user_id = p_actor;
  delete from public.blocks where blocker_id = p_actor or blocked_user_id = p_actor;

  update public.users
     set kakao_id = p_anonymized_kakao_id,
         nickname = '탈퇴한 사용자',
         profile_image_url = null,
         email = null,
         email_verified = false,
         email_bounce_count = 0,
         notification_pref = '{}'::jsonb,
         status = 'WITHDRAWN',
         withdrawn_at = now(),
         updated_at = now()
   where id = p_actor;

  v_response := jsonb_build_object('status', 'WITHDRAWN');
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_profile_nickname_update(
  p_idempotency_key uuid,
  p_actor uuid,
  p_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := public.lf_normalize_input(p_nickname);
  v_cached jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'profile-nickname-update');
  if v_cached is not null then return v_cached; end if;
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 40 then
    raise exception 'E_VALIDATION';
  end if;
  update public.users
     set nickname = v_nickname, updated_at = now()
   where id = p_actor;
  v_response := jsonb_build_object('nickname', v_nickname);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_promise_hide(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_hidden boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.promise_status;
  v_cached jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'promise-hide');
  if v_cached is not null then return v_cached; end if;
  select p.status into v_status
  from public.promises p
  where p.id = p_promise_id
    and (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants pp
        where pp.promise_id = p.id and pp.user_id = p_actor and pp.status = 'JOINED'
      )
    )
  for update;
  if not found then raise exception 'E_NOT_FOUND'; end if;
  if v_status not in ('COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED') then
    raise exception 'E_STATE_CONFLICT';
  end if;

  update public.promises p
     set hidden_by = case
       when p_hidden and not (p.hidden_by ? p_actor::text)
         then p.hidden_by || jsonb_build_array(p_actor::text)
       when not p_hidden then p.hidden_by - p_actor::text
       else p.hidden_by
     end
   where p.id = p_promise_id;
  v_response := jsonb_build_object('promise_id', p_promise_id, 'hidden', p_hidden);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_users_share_promise(
  p_actor uuid,
  p_target uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.promises p
    where (
      p.creator_id = p_actor
      or exists (
        select 1 from public.promise_participants mine
        where mine.promise_id = p.id and mine.user_id = p_actor and mine.status = 'JOINED'
      )
    ) and (
      p.creator_id = p_target
      or exists (
        select 1 from public.promise_participants theirs
        where theirs.promise_id = p.id and theirs.user_id = p_target and theirs.status = 'JOINED'
      )
    )
  )
$$;

create or replace function public.lf_user_block(
  p_idempotency_key uuid,
  p_actor uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'user-block');
  if v_cached is not null then return v_cached; end if;
  if p_target_user_id = p_actor then raise exception 'E_VALIDATION'; end if;
  if not public.lf_users_share_promise(p_actor, p_target_user_id) then
    raise exception 'E_NOT_FOUND';
  end if;
  insert into public.blocks (blocker_id, blocked_user_id)
  values (p_actor, p_target_user_id)
  on conflict (blocker_id, blocked_user_id) do nothing;
  v_response := jsonb_build_object('target_user_id', p_target_user_id, 'blocked', true);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.lf_safety_report(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_target_user_id uuid,
  p_evidence_id uuid,
  p_reason public.report_reason,
  p_detail text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
  v_detail text := nullif(public.lf_normalize_input(p_detail), '');
  v_evidence_blinded boolean := false;
  v_cached jsonb;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_actor);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'safety-report');
  if v_cached is not null then return v_cached; end if;
  if not exists (
    select 1 from public.promises p
    where p.id = p_promise_id
      and (
        p.creator_id = p_actor
        or exists (
          select 1 from public.promise_participants pp
          where pp.promise_id = p.id and pp.user_id = p_actor and pp.status = 'JOINED'
        )
      )
  ) then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_detail is not null and char_length(v_detail) > 500 then raise exception 'E_VALIDATION'; end if;
  if p_target_user_id = p_actor then raise exception 'E_VALIDATION'; end if;
  if p_target_user_id is not null and not exists (
    select 1 from public.promises p
    where p.id = p_promise_id
      and (
        p.creator_id = p_target_user_id
        or exists (
          select 1 from public.promise_participants pp
          where pp.promise_id = p.id and pp.user_id = p_target_user_id and pp.status = 'JOINED'
        )
      )
  ) then
    raise exception 'E_NOT_FOUND';
  end if;
  if p_evidence_id is not null then
    update public.fulfillment_evidences e
       set blinded_at = coalesce(e.blinded_at, now())
     where e.id = p_evidence_id and e.promise_id = p_promise_id;
    if not found then raise exception 'E_NOT_FOUND'; end if;
    v_evidence_blinded := true;
  end if;

  insert into public.reports
    (reporter_id, target_user_id, promise_id, evidence_id, reason, detail)
  values
    (p_actor, p_target_user_id, p_promise_id, p_evidence_id, p_reason, v_detail)
  returning id into v_report_id;

  v_response := jsonb_build_object(
    'report_id', v_report_id,
    'status', 'RECEIVED',
    'evidence_blinded', v_evidence_blinded
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_is_active_actor() from public;
revoke all on function public.lf_account_withdraw(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.lf_profile_nickname_update(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.lf_promise_hide(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.lf_users_share_promise(uuid, uuid) from public, anon, authenticated;
revoke all on function public.lf_user_block(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.lf_safety_report(uuid, uuid, uuid, uuid, uuid, public.report_reason, text)
  from public, anon, authenticated;

-- RLS 식 자체가 호출하므로 로그인 역할에는 실행만 열어야 한다. 반환값은 본인 활성 여부 한 비트다.
grant execute on function public.lf_is_active_actor() to anon, authenticated, service_role;
grant execute on function public.lf_account_withdraw(uuid, uuid, text) to service_role;
grant execute on function public.lf_profile_nickname_update(uuid, uuid, text) to service_role;
grant execute on function public.lf_promise_hide(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.lf_users_share_promise(uuid, uuid) to service_role;
grant execute on function public.lf_user_block(uuid, uuid, uuid) to service_role;
grant execute on function public.lf_safety_report(uuid, uuid, uuid, uuid, uuid, public.report_reason, text)
  to service_role;
