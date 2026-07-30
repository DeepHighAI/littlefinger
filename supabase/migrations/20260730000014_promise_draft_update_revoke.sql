-- DRAFT 수정 · 현재 상대 초대 무효화 — 02 §4-2-2.4 · §4-3-2.
--
-- DRAFT 내용의 원본은 promise_versions v1 이고 promises 의 같은 열은 조회 캐시다. 둘을
-- 클라이언트가 따로 고치게 두면 어느 한 요청 실패만으로 초대 화면과 목록의 내용이 갈린다.
-- 이 파일은 두 행과 선택적인 T-02를 같은 트랜잭션 경계 안에 둔다.
--
-- 초대 무효화는 약속 취소가 아니다. 현재 PARTNER 링크만 즉시 닫고 약속은 PENDING으로
-- 남겨야 SCR-A04에서 새 링크를 발급할 수 있다.

-- ============================================================
-- DRAFT v1 덮어쓰기 + 선택적 T-02
-- ============================================================

create or replace function public.lf_promise_draft_update(
  p_idempotency_key uuid,
  p_user_id         uuid,
  p_promise_id      uuid,
  p_title           text,
  p_body            text,
  p_category        text,
  p_end_date        text,
  p_keeper          text,
  p_reward          text,
  p_penalty         text,
  p_witness_enabled boolean,
  p_token_hash      char(64)
)
returns jsonb
language plpgsql
as $$
declare
  v_cached       jsonb;
  v_creator_id   uuid;
  v_status       public.promise_status;
  v_title        text := public.lf_normalize_input(p_title);
  v_body         text := public.lf_normalize_input(p_body);
  v_reward       text := nullif(public.lf_normalize_input(p_reward), '');
  v_penalty      text := nullif(public.lf_normalize_input(p_penalty), '');
  v_keeper       text := coalesce(nullif(btrim(p_keeper), ''), 'BOTH');
  v_end_date     date;
  v_today_kst    date := (now() at time zone 'Asia/Seoul')::date;
  v_days         int;
  v_updated_rows int;
  v_response     jsonb;
begin
  perform public.lf_assert_actor(p_user_id);

  -- 같은 키의 두 저장이 버전 행을 두 번 덮어쓰지 않도록 내용 조회보다 먼저 클레임한다.
  v_cached := public.lf_idempotency_begin(
    p_idempotency_key, p_user_id, 'promise-draft-update'
  );
  if v_cached is not null then
    return v_cached;
  end if;

  begin
    v_end_date := p_end_date::date;
  exception
    when others then
      raise exception 'E_VALIDATION';
  end;

  perform public.lf_assert_promise_content(
    v_title, v_body, p_category, v_keeper, v_reward, v_penalty
  );

  -- 새 DRAFT를 만드는 T-01과 같은 규칙이다. 수정이라고 오늘이나 1년 밖의 날짜를 허용하면
  -- 생성 경로를 한 번 거친 뒤 서버 정책을 우회할 수 있다.
  v_days := v_end_date - v_today_kst;
  if v_days < 1 or v_days > public.lf_end_date_max_days() then
    raise exception 'E_VALIDATION';
  end if;

  select p.creator_id, p.status
    into v_creator_id, v_status
    from public.promises p
   where p.id = p_promise_id;

  -- 존재하지 않는 약속과 남의 약속은 같은 답이다(§9 원칙 1).
  if not found or v_creator_id <> p_user_id then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_status <> 'DRAFT' then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 조건부 UPDATE가 직렬화 지점이다. 위 조회 뒤 다른 전이가 끼어들면 0행이 되어 수정이
  -- 확정 뒤로 새지 않는다. 아래 버전 갱신이 먼저 실패해도 함수 트랜잭션 전체가 롤백된다.
  update public.promises
     set title = v_title,
         body = v_body,
         category = p_category::public.promise_category,
         end_date = v_end_date,
         keeper = v_keeper::public.keeper,
         reward = v_reward,
         penalty = v_penalty,
         witness_enabled = coalesce(p_witness_enabled, false),
         lock_version = lock_version + 1,
         updated_at = now()
   where id = p_promise_id
     and creator_id = p_user_id
     and status = 'DRAFT';

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows <> 1 then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 확정 전에는 버전을 추가하지 않고 v1 하나만 덮어쓴다(§4-2-2.4). 활성화된 행을 조건에서
  -- 제외해 상태 열이 잘못된 데이터에서도 확정 내용을 덮어쓰지 못하게 한다.
  update public.promise_versions
     set title = v_title,
         body = v_body,
         category = p_category::public.promise_category,
         end_date = v_end_date,
         keeper = v_keeper::public.keeper,
         reward = v_reward,
         penalty = v_penalty,
         content_hash = public.lf_content_hash(
           v_title, v_body, p_category::public.promise_category, v_end_date,
           v_keeper::public.keeper, v_reward, v_penalty, 1
         )
   where promise_id = p_promise_id
     and version_no = 1
     and activated_at is null;

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows <> 1 then
    -- 실제 데이터 불변식 위반이다. E_*로 위장하지 않아 껍데기가 공통 500으로 평탄화하게 한다.
    raise exception 'DRAFT version invariant violated';
  end if;

  if p_token_hash is null then
    v_response := jsonb_build_object('promise_id', p_promise_id, 'status', 'DRAFT');
  else
    -- 같은 함수 안에서 부르므로 내용 저장과 T-02는 함께 커밋되거나 함께 롤백된다.
    v_response := public.lf_invite_issue_row(p_user_id, p_promise_id, p_token_hash);
  end if;

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_promise_draft_update is
  'DRAFT v1과 조회 캐시 수정. token_hash가 있으면 같은 트랜잭션에서 T-02까지 실행한다.';

-- ============================================================
-- 현재 PARTNER 초대 무효화
-- ============================================================

create or replace function public.lf_invite_revoke(
  p_idempotency_key uuid,
  p_user_id         uuid,
  p_promise_id      uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_cached       jsonb;
  v_invitation_id uuid;
  v_creator_id   uuid;
  v_status       public.promise_status;
  v_response     jsonb;
begin
  perform public.lf_assert_actor(p_user_id);

  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_user_id, 'invite-revoke');
  if v_cached is not null then
    return v_cached;
  end if;

  -- 승인 경로와 같은 invitations → promises 순서다. 승인과 무효화가 동시에 오면 먼저
  -- 초대 행을 잡은 한쪽만 성공하고, 뒤쪽은 커밋 뒤 상태를 다시 보고 정해진 오류를 낸다.
  select i.id
    into v_invitation_id
    from public.invitations i
   where i.promise_id = p_promise_id
     and i.target_role = 'PARTNER'
     and i.status = 'PENDING'
   order by i.created_at desc, i.id desc
   limit 1
   for update;

  select p.creator_id, p.status
    into v_creator_id, v_status
    from public.promises p
   where p.id = p_promise_id;

  if not found or v_creator_id <> p_user_id then
    raise exception 'E_NOT_FOUND';
  end if;

  if v_status <> 'PENDING' or v_invitation_id is null then
    raise exception 'E_STATE_CONFLICT';
  end if;

  update public.invitations
     set status = 'REVOKED'
   where id = v_invitation_id
     and status = 'PENDING';

  if not found then
    raise exception 'E_STATE_CONFLICT';
  end if;

  -- 이미 닫힌 링크의 만료 예정 알림은 거짓 알림이다. 다른 종류의 예약은 건드리지 않는다.
  update public.reminder_schedules
     set status = 'CANCELED'
   where promise_id = p_promise_id
     and kind = 'INVITE_EXPIRE_SOON'
     and status = 'PENDING';

  v_response := jsonb_build_object(
    'promise_id', p_promise_id,
    'status', 'PENDING',
    'invitation_status', 'REVOKED'
  );

  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

comment on function public.lf_invite_revoke is
  '현재 PARTNER 초대를 무효화하고 약속은 PENDING으로 유지한다(02 §4-3-2).';

-- ============================================================
-- 실행 권한 — 서버만
-- ============================================================

revoke all on function public.lf_promise_draft_update(
  uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char(64)
) from public, anon, authenticated;
revoke all on function public.lf_invite_revoke(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.lf_promise_draft_update(
  uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char(64)
) to service_role;
grant execute on function public.lf_invite_revoke(uuid, uuid, uuid) to service_role;
