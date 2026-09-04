-- 보존 만료 참여자가 예전에 받아둔 evidence_id 로 서명 URL 을 계속 받아가던 구멍을 막는다.
--
-- 2026-08-29 보존 도입(20260829103504)이 약속 범위 읽기 경로를 전부 lf_has_record_access 로
-- 감쌌지만 이 함수만 빠졌다. 증빙 목록을 주는 lf_promise_fulfillment_detail 은 막히는데
-- 그 목록의 id 로 원본 파일을 여는 이 경로는 열려 있었다. 한쪽이 영구 보관을 사면 기록은
-- 살아남으므로, 열람권이 끝난 반대쪽·증인이 캐시해 둔 id 로 계속 사진을 열 수 있었다.
--
-- promise_participants.status 는 보존 만료로 바뀌지 않는다(JOINED 그대로). 그래서 기존
-- 역할 검사만으로는 절대 걸러지지 않는다 — 만료 검사를 따로 넣어야 한다.
--
-- security invoker 를 유지한다. 호출자는 Edge Function 의 service_role 이고,
-- lf_has_record_access 는 20260829103504 에서 service_role 에 execute 가 부여돼 있다.
-- create or replace 라 기존 revoke/grant(20260731133106 §1046·1053)는 그대로 남는다.
create or replace function public.lf_evidence_sign_target(
  p_actor       uuid,
  p_evidence_id uuid,
  p_variant     text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  c_signed_seconds constant int := 600;
  v_evidence public.fulfillment_evidences%rowtype;
  v_check    public.fulfillment_checks%rowtype;
  v_promise  public.promises%rowtype;
  v_role     public.participant_role;
  v_key      text;
begin
  perform public.lf_assert_actor(p_actor);

  if p_variant not in ('FULL', 'THUMBNAIL') then
    raise exception 'E_VALIDATION';
  end if;

  select *
    into v_evidence
    from public.fulfillment_evidences fe
   where fe.id = p_evidence_id
     and fe.removed_at is null
     and fe.blinded_at is null
     and fe.purged_at is null;

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  -- 없는 id 와 만료된 열람권을 같은 E_NOT_FOUND 로 답한다(02 §9 원칙 1: 존재를 알리지 않는다).
  -- purge_state 가 AVAILABLE 이 아닌 동안에도 false 라서 정리 중 서명까지 함께 막힌다.
  if not public.lf_has_record_access(p_actor, v_evidence.promise_id, now()) then
    raise exception 'E_NOT_FOUND';
  end if;

  select *
    into v_check
    from public.fulfillment_checks fc
   where fc.id = v_evidence.check_id;

  select *
    into v_promise
    from public.promises p
   where p.id = v_evidence.promise_id;

  select pp.role
    into v_role
    from public.promise_participants pp
   where pp.promise_id = v_evidence.promise_id
     and pp.user_id = p_actor
     and pp.status = 'JOINED'
     and pp.role in ('CREATOR', 'PARTNER', 'WITNESS');

  if not found then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_role in ('CREATOR', 'PARTNER')
     and v_evidence.uploaded_by <> p_actor
     and v_check.round_no = v_promise.check_round_no
     and not exists (
       select 1
         from public.fulfillment_checks mine
        where mine.promise_id = v_evidence.promise_id
          and mine.user_id = p_actor
          and mine.round_no = v_check.round_no
     ) then
    raise exception 'E_NOT_FOUND';
  end if;

  v_key := case
    when p_variant = 'FULL' then v_evidence.storage_key
    else v_evidence.thumb_key
  end;

  if v_key is null then
    raise exception 'E_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'evidence_id', v_evidence.id,
    'bucket_id', 'fulfillment-evidences',
    'object_key', v_key,
    'variant', p_variant,
    'expires_in', c_signed_seconds
  );
end;
$$;
