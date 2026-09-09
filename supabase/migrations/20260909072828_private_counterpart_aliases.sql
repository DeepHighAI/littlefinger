-- 별칭은 내 계정의 표시 설정이며 상대 프로필과 합의 기록에는 쓰지 않는다.
create table public.user_aliases (
  owner_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 40 and alias = public.lf_normalize_input(alias)),
  updated_at timestamptz not null default now(),
  primary key (owner_id, target_user_id),
  check (owner_id <> target_user_id)
);
create index user_aliases_target_idx on public.user_aliases(target_user_id);
alter table public.user_aliases enable row level security;
revoke all on public.user_aliases from public, anon, authenticated;
grant select on public.user_aliases to authenticated;
grant all on public.user_aliases to service_role;
create policy "read own aliases" on public.user_aliases for select to authenticated
  using (owner_id = (select auth.uid()) and private.lf_is_active_actor());

create function public.lf_counterpart_alias_get(p_actor uuid, p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_target uuid;
  v_nickname text;
begin
  perform public.lf_assert_actor(p_actor);
  if not public.lf_has_record_access(p_actor, p_promise_id, now()) then
    raise exception 'E_NOT_FOUND';
  end if;
  select target.user_id, u.nickname into v_target, v_nickname
    from public.promise_participants mine
    join public.promise_participants target on target.promise_id = mine.promise_id
      and target.user_id <> mine.user_id and target.role in ('CREATOR','PARTNER')
      and target.status = 'JOINED'
    join public.users u on u.id = target.user_id and u.status = 'ACTIVE'
    join public.promises p on p.id = mine.promise_id
   where mine.promise_id = p_promise_id and mine.user_id = p_actor
     and mine.role in ('CREATOR','PARTNER') and mine.status = 'JOINED'
     and not (p.hidden_by ? p_actor::text);
  if v_target is null then raise exception 'E_NOT_FOUND'; end if;
  return jsonb_build_object('target_user_id', v_target, 'nickname', v_nickname,
    'alias', (select a.alias from public.user_aliases a
      where a.owner_id = p_actor and a.target_user_id = v_target));
end;
$$;

create function public.lf_counterpart_alias_update(
  p_idempotency_key uuid, p_actor uuid, p_promise_id uuid, p_alias text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_view jsonb;
  v_target uuid;
  v_alias text := public.lf_normalize_input(p_alias);
  v_cached jsonb;
begin
  v_view := public.lf_counterpart_alias_get(p_actor, p_promise_id);
  v_target := (v_view->>'target_user_id')::uuid;
  -- 탈퇴 트리거와 직렬화해 탈퇴 직후 별칭을 다시 넣는 경쟁을 막는다.
  perform u.id from public.users u where u.id in (p_actor, v_target) order by u.id for update;
  v_view := public.lf_counterpart_alias_get(p_actor, p_promise_id);
  v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'counterpart-alias-update');
  if v_cached is not null then return v_cached; end if;
  if p_alias is not null and (v_alias is null or char_length(v_alias) not between 1 and 40) then
    raise exception 'E_VALIDATION';
  end if;
  if p_alias is null then
    delete from public.user_aliases where owner_id = p_actor and target_user_id = v_target;
  else
    insert into public.user_aliases(owner_id, target_user_id, alias)
      values (p_actor, v_target, v_alias)
      on conflict (owner_id, target_user_id) do update set alias = excluded.alias, updated_at = now();
  end if;
  v_view := public.lf_counterpart_alias_get(p_actor, p_promise_id);
  perform public.lf_idempotency_finish(p_idempotency_key, v_view);
  return v_view;
end;
$$;

create function public.lf_delete_withdrawn_aliases()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.user_aliases where owner_id = new.id or target_user_id = new.id;
  return new;
end;
$$;
create trigger delete_withdrawn_aliases after update of status on public.users
  for each row when (new.status = 'WITHDRAWN' and old.status is distinct from new.status)
  execute function public.lf_delete_withdrawn_aliases();

-- 기존 앱의 정확 키 파서를 유지하며 현재 참여자 표시만 치환한다.
create function public.lf_alias_current_people(p_actor uuid, p_view jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_view jsonb := p_view;
  v_role text;
  v_alias text;
begin
  if p_view->>'my_role' not in ('CREATOR','PARTNER') then return p_view; end if;
  foreach v_role in array array['creator','partner'] loop
    select a.alias into v_alias from public.user_aliases a
      join public.users u on u.id = a.target_user_id and u.status = 'ACTIVE'
      where a.owner_id = p_actor and a.target_user_id = (p_view->v_role->>'user_id')::uuid;
    if v_alias is not null then
      v_view := jsonb_set(v_view, array[v_role,'nickname'], to_jsonb(v_alias));
    end if;
  end loop;
  return v_view;
end;
$$;

create or replace function public.lf_promise_detail(p_actor uuid,p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then raise exception 'E_NOT_FOUND'; end if;
  return public.lf_alias_current_people(p_actor, public.lf_promise_detail_unfiltered(p_actor,p_promise_id));
end;
$$;
create or replace function public.lf_promise_fulfillment_detail(p_actor uuid,p_promise_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lf_has_record_access(p_actor,p_promise_id,now()) then raise exception 'E_NOT_FOUND'; end if;
  return public.lf_alias_current_people(p_actor, public.lf_promise_fulfillment_detail_unfiltered(p_actor,p_promise_id));
end;
$$;

create function public.lf_alias_home_cards(p_actor uuid, p_cards jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(case when a.alias is null then item.value
      else jsonb_set(item.value, array[lower(target.role::text),'nickname'], to_jsonb(a.alias)) end
      order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(p_cards) with ordinality item(value, ordinality)
  left join public.promise_participants target on target.promise_id = (item.value->>'promise_id')::uuid
    and target.role = (case item.value->>'my_role' when 'CREATOR' then 'PARTNER'
      when 'PARTNER' then 'CREATOR' else null end)::public.participant_role
    and target.status = 'JOINED'
  left join public.users u on u.id = target.user_id and u.status = 'ACTIVE'
  left join public.user_aliases a on a.owner_id = p_actor and a.target_user_id = u.id;
$$;
alter function public.lf_promise_home_list(uuid,text,jsonb,timestamptz)
  rename to lf_promise_home_list_before_aliases;
create function public.lf_promise_home_list(
  p_actor uuid, p_tab text, p_cursor jsonb default null, p_now timestamptz default now()
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_view jsonb;
begin
  v_view := public.lf_promise_home_list_before_aliases(p_actor,p_tab,p_cursor,p_now);
  v_view := jsonb_set(v_view, '{items}', public.lf_alias_home_cards(p_actor,v_view->'items'));
  return jsonb_set(v_view, '{pinned}', public.lf_alias_home_cards(p_actor,v_view->'pinned'));
end;
$$;

revoke all on function public.lf_counterpart_alias_get(uuid,uuid),
  public.lf_counterpart_alias_update(uuid,uuid,uuid,text), public.lf_delete_withdrawn_aliases(),
  public.lf_alias_current_people(uuid,jsonb), public.lf_alias_home_cards(uuid,jsonb),
  public.lf_promise_home_list_before_aliases(uuid,text,jsonb,timestamptz),
  public.lf_promise_home_list(uuid,text,jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.lf_counterpart_alias_get(uuid,uuid),
  public.lf_counterpart_alias_update(uuid,uuid,uuid,text),
  public.lf_promise_home_list(uuid,text,jsonb,timestamptz) to service_role;
