begin;

insert into public.users (id, provider_user_id, nickname, primary_surface)
values (
  '00000000-0000-4000-8000-00000000f001',
  'remote-j04-j06-fixture',
  '원격 배치 검증',
  'APP'
);

insert into public.promises (id, creator_id, status, title, updated_at)
values
  (
    '00000000-0000-4000-8000-00000000f101',
    '00000000-0000-4000-8000-00000000f001',
    'PENDING',
    'J-04 원격 검증',
    '2026-08-01T00:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-00000000f102',
    '00000000-0000-4000-8000-00000000f001',
    'DRAFT',
    'J-06 예약 원격 검증',
    '2026-08-17T00:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-00000000f103',
    '00000000-0000-4000-8000-00000000f001',
    'DRAFT',
    'J-06 삭제 원격 검증',
    '2026-05-18T00:00:00Z'
  );

insert into public.invitations (
  id,
  promise_id,
  target_role,
  token_hash,
  created_by,
  expires_at
)
values (
  '00000000-0000-4000-8000-00000000f201',
  '00000000-0000-4000-8000-00000000f101',
  'PARTNER',
  repeat('a', 64),
  '00000000-0000-4000-8000-00000000f001',
  '2026-08-17T00:00:00Z'
);

insert into public.approvals (
  promise_id,
  user_id,
  role,
  action,
  surface
)
values (
  '00000000-0000-4000-8000-00000000f102',
  '00000000-0000-4000-8000-00000000f001',
  'CREATOR',
  'AMEND_SUGGEST',
  'APP'
);

insert into public.reminder_schedules (
  promise_id,
  user_id,
  kind,
  fire_at,
  status
)
values (
  '00000000-0000-4000-8000-00000000f103',
  '00000000-0000-4000-8000-00000000f001',
  'DRAFT_DELETE_SOON',
  '2026-08-10T00:00:00Z',
  'SENT'
);

do $$
declare
  v_now constant timestamptz := '2026-08-18T12:00:00Z';
  v_j04_first jsonb;
  v_j04_second jsonb;
  v_j06_first jsonb;
  v_j06_second jsonb;
  v_count int;
begin
  v_j04_first := public.lf_expire_invitations(v_now, 200);
  v_j04_second := public.lf_expire_invitations(v_now, 200);

  if v_j04_first <> '{"expired": 1, "notified": 1}'::jsonb then
    raise exception 'J-04 first run mismatch: %', v_j04_first;
  end if;
  if v_j04_second <> '{"expired": 0, "notified": 0}'::jsonb then
    raise exception 'J-04 second run mismatch: %', v_j04_second;
  end if;

  select count(*) into v_count
  from public.notification_outbox o
  where o.promise_id = '00000000-0000-4000-8000-00000000f101'
    and o.event = 'NT-05';
  if v_count <> 1 then
    raise exception 'J-04 outbox duplicate count: %', v_count;
  end if;

  v_j06_first := public.lf_prepare_draft_cleanup(v_now, 200);
  v_j06_second := public.lf_prepare_draft_cleanup(v_now, 200);

  if v_j06_first <> '{"deleted": 1, "scheduled": 2}'::jsonb then
    raise exception 'J-06 first run mismatch: %', v_j06_first;
  end if;
  if v_j06_second <> '{"deleted": 0, "scheduled": 0}'::jsonb then
    raise exception 'J-06 second run mismatch: %', v_j06_second;
  end if;

  select count(*) into v_count
  from public.reminder_schedules rs
  where rs.promise_id = '00000000-0000-4000-8000-00000000f102'
    and rs.status = 'PENDING'
    and rs.kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON');
  if v_count <> 2 then
    raise exception 'J-06 pending schedule count: %', v_count;
  end if;

  select count(*) into v_count
  from public.promises p
  where p.id = '00000000-0000-4000-8000-00000000f103';
  if v_count <> 0 then
    raise exception 'J-06 expired draft was not deleted';
  end if;
end;
$$;

rollback;

select jsonb_build_object(
  'j04_same_time_twice', 'PASS',
  'j06_same_time_twice', 'PASS',
  'fixture_persisted', false
) as verification;
