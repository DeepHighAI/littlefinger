-- E2E Run 1 (2026-08-19) finding F3 fix: 차단(lf_user_block)은 있는데 목록·해제가 없어
-- 차단이 제품 안에서 비가역이었다. 02 §5(SCR-A08)는 "차단 목록 관리"를 명시한다.
--
-- 목록은 차단 상대의 닉네임이 필요한데 users 는 자기 행만 읽히므로(§9) RLS 셀렉트로는
-- 만들 수 없다 — 서버 함수로 낸다. 탈퇴한 상대는 users.nickname 이 이미 "탈퇴한 사용자"로
-- 비식별화돼 있어 그대로 노출해도 §9를 지킨다.

create or replace function public.lf_user_block_list(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  perform public.lf_assert_actor(p_actor);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'target_user_id', b.blocked_user_id,
               'nickname', u.nickname,
               'profile_image_url', u.profile_image_url,
               'blocked_at', b.created_at
             )
             order by b.created_at desc, b.id desc
           ),
           '[]'::jsonb
         )
    into v_items
    from public.blocks b
    join public.users u on u.id = b.blocked_user_id
   where b.blocker_id = p_actor;

  return jsonb_build_object('items', v_items);
end;
$$;

create or replace function public.lf_user_unblock(
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
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'user-unblock');
  if v_cached is not null then return v_cached; end if;
  if p_target_user_id = p_actor then raise exception 'E_VALIDATION'; end if;

  -- blocker_id 필터가 곧 권한 검사다 — 남의 차단 행은 이 delete 가 닿지 못한다.
  -- 이미 풀린 차단의 재해제도 성공으로 수렴시킨다: 목록 화면의 재시도·중복 탭에서
  -- E_NOT_FOUND 로 되튀면 사용자가 할 수 있는 일이 없다.
  delete from public.blocks
   where blocker_id = p_actor
     and blocked_user_id = p_target_user_id;

  v_response := jsonb_build_object('target_user_id', p_target_user_id, 'blocked', false);
  perform public.lf_idempotency_finish(p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.lf_user_block_list(uuid)
  from public, anon, authenticated;
revoke all on function public.lf_user_unblock(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lf_user_block_list(uuid) to service_role;
grant execute on function public.lf_user_unblock(uuid, uuid, uuid) to service_role;
