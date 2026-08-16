-- J-09 기록 무결성 — 실패 결과는 참여자 표면이 아니라 운영 전용 incident에만 남긴다.

-- server-only: integrity_incidents 무결성 배치와 운영 점검만 접근한다.
create table public.integrity_incidents (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises (id) on delete cascade,
  version_id uuid not null references public.promise_versions (id),
  kind text not null check (kind in ('HASH_MISMATCH', 'CACHE_MISMATCH')),
  stored_hash char(64) not null,
  computed_hash char(64) not null,
  mismatch_fields text[] not null default '{}',
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  resolved_at timestamptz,
  unique (promise_id, version_id, kind)
);

create index integrity_incidents_version_id_idx
  on public.integrity_incidents (version_id);

alter table public.integrity_incidents enable row level security;
revoke all privileges on table public.integrity_incidents from public, anon, authenticated;
grant select, insert, update on table public.integrity_incidents to service_role;

create or replace function public.lf_verify_promise_integrity(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_computed_hash char(64);
  v_cache_hash char(64);
  v_mismatch_fields text[];
  v_hash_failed boolean;
  v_cache_failed boolean;
  v_checked_count int := 0;
  v_failed_count int := 0;
  v_resolved_count int := 0;
  v_changed int;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j09-integrity', 0)
  );

  for v_row in
    select
      p.id as promise_id,
      p.title as cache_title,
      p.body as cache_body,
      p.category as cache_category,
      p.end_date as cache_end_date,
      p.keeper as cache_keeper,
      p.reward as cache_reward,
      p.penalty as cache_penalty,
      p.current_version_id as cache_version_id,
      v.id as version_id,
      v.version_no,
      v.title as version_title,
      v.body as version_body,
      v.category as version_category,
      v.end_date as version_end_date,
      v.keeper as version_keeper,
      v.reward as version_reward,
      v.penalty as version_penalty,
      v.content_hash as stored_hash
    from public.promises p
    join lateral (
      select pv.*
      from public.promise_versions pv
      where pv.promise_id = p.id
        and pv.activated_at is not null
      order by pv.version_no desc, pv.id desc
      limit 1
    ) v on true
    order by p.id
  loop
    v_checked_count := v_checked_count + 1;
    v_computed_hash := public.lf_content_hash(
      v_row.version_title,
      v_row.version_body,
      v_row.version_category,
      v_row.version_end_date,
      v_row.version_keeper,
      v_row.version_reward,
      v_row.version_penalty,
      v_row.version_no
    );
    v_cache_hash := public.lf_content_hash(
      v_row.cache_title,
      v_row.cache_body,
      v_row.cache_category,
      v_row.cache_end_date,
      v_row.cache_keeper,
      v_row.cache_reward,
      v_row.cache_penalty,
      v_row.version_no
    );

    select coalesce(pg_catalog.array_agg(field_name order by position), '{}'::text[])
      into v_mismatch_fields
      from (
        values
          (1, 'title', v_row.cache_title is not distinct from v_row.version_title),
          (2, 'body', v_row.cache_body is not distinct from v_row.version_body),
          (3, 'category', v_row.cache_category is not distinct from v_row.version_category),
          (4, 'end_date', v_row.cache_end_date is not distinct from v_row.version_end_date),
          (5, 'keeper', v_row.cache_keeper is not distinct from v_row.version_keeper),
          (6, 'reward', v_row.cache_reward is not distinct from v_row.version_reward),
          (7, 'penalty', v_row.cache_penalty is not distinct from v_row.version_penalty),
          (8, 'current_version_id', v_row.cache_version_id is not distinct from v_row.version_id)
      ) as comparisons(position, field_name, matches)
     where not matches;

    v_hash_failed := v_computed_hash is distinct from v_row.stored_hash;
    v_cache_failed := pg_catalog.cardinality(v_mismatch_fields) > 0;

    if v_hash_failed then
      insert into public.integrity_incidents (
        promise_id, version_id, kind, stored_hash, computed_hash, mismatch_fields,
        first_detected_at, last_detected_at, resolved_at
      ) values (
        v_row.promise_id, v_row.version_id, 'HASH_MISMATCH',
        v_row.stored_hash, v_computed_hash, '{}'::text[], p_now, p_now, null
      )
      on conflict (promise_id, version_id, kind) do update set
        stored_hash = excluded.stored_hash,
        computed_hash = excluded.computed_hash,
        mismatch_fields = excluded.mismatch_fields,
        last_detected_at = excluded.last_detected_at,
        resolved_at = null;
    else
      update public.integrity_incidents
         set resolved_at = p_now
       where promise_id = v_row.promise_id
         and version_id = v_row.version_id
         and kind = 'HASH_MISMATCH'
         and resolved_at is null;
      get diagnostics v_changed = row_count;
      v_resolved_count := v_resolved_count + v_changed;
    end if;

    if v_cache_failed then
      insert into public.integrity_incidents (
        promise_id, version_id, kind, stored_hash, computed_hash, mismatch_fields,
        first_detected_at, last_detected_at, resolved_at
      ) values (
        v_row.promise_id, v_row.version_id, 'CACHE_MISMATCH',
        v_row.stored_hash, v_cache_hash, v_mismatch_fields, p_now, p_now, null
      )
      on conflict (promise_id, version_id, kind) do update set
        stored_hash = excluded.stored_hash,
        computed_hash = excluded.computed_hash,
        mismatch_fields = excluded.mismatch_fields,
        last_detected_at = excluded.last_detected_at,
        resolved_at = null;
    else
      update public.integrity_incidents
         set resolved_at = p_now
       where promise_id = v_row.promise_id
         and version_id = v_row.version_id
         and kind = 'CACHE_MISMATCH'
         and resolved_at is null;
      get diagnostics v_changed = row_count;
      v_resolved_count := v_resolved_count + v_changed;
    end if;

    if v_hash_failed or v_cache_failed then
      v_failed_count := v_failed_count + 1;
    end if;

    update public.promises
       set hash_verified_at = p_now
     where id = v_row.promise_id;
  end loop;

  return pg_catalog.jsonb_build_object(
    'checked_count', v_checked_count,
    'failed_count', v_failed_count,
    'resolved_count', v_resolved_count
  );
end;
$$;

revoke all on function public.lf_verify_promise_integrity(timestamptz)
  from public, anon, authenticated;
grant execute on function public.lf_verify_promise_integrity(timestamptz)
  to service_role;

comment on function public.lf_verify_promise_integrity(timestamptz) is
  'J-09: 최신 활성 버전 해시와 읽기 캐시를 검증하고 운영 전용 incident 수명주기를 갱신한다.';
