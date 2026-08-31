-- PENDING 약속 삭제 — 작성자가 발송을 취소하면 확정 전 기록과 모든 초대 경로를 함께 지운다.
-- CANCELED는 ACTIVE 이후 상호 합의 파기 상태이므로 재사용하지 않는다. 이 동작은 상태 전이가
-- 아니라 DRAFT 삭제와 같은 확정 전 하드 삭제다(PO 2026-08-31).

create or replace function public.lf_promise_pending_delete(
  p_idempotency_key uuid,
  p_user_id uuid,
  p_promise_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_cached jsonb;
  v_creator_id uuid;
  v_status public.promise_status;
  v_response jsonb;
begin
  perform public.lf_assert_actor(p_user_id);
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key,
    p_user_id,
    'promise-pending-delete'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  -- 승인·거절·증인 참여 경로와 같은 invitations → promises 순서다. 상대 수락과 삭제가
  -- 동시에 오면 초대 행을 먼저 잡은 한쪽만 확정되고, 다른 쪽은 커밋된 결과를 다시 본다.
  perform i.id
    from public.invitations i
   where i.promise_id = p_promise_id
   order by i.created_at, i.id
   for update;

  select p.creator_id, p.status
    into v_creator_id, v_status
    from public.promises p
   where p.id = p_promise_id
   for update;

  if not found or v_creator_id <> p_user_id then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_status <> 'PENDING' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 신고는 약속보다 오래 사는 운영 근거다. 본문은 지우되 신고 자체는 보존한다.
  update public.reports
     set evidence_id = null,
         promise_id = null
   where promise_id = p_promise_id;

  -- invitations·participants·versions·reminders·notifications·witness approvals 등은 FK
  -- cascade로 같은 트랜잭션에서 사라진다. 따라서 상대의 수락 대기 경로도 즉시 닫힌다.
  delete from public.promises
   where id = p_promise_id
     and creator_id = p_user_id
     and status = 'PENDING';

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'deleted', true
  );
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_promise_pending_delete(uuid, uuid, uuid) is
  '작성자 전용 PENDING 하드 삭제. 초대와 상대 수락 대기 경로를 원자적으로 제거한다.';

revoke all on function public.lf_promise_pending_delete(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_promise_pending_delete(uuid, uuid, uuid)
  to service_role;
