select jsonb_build_object(
  'cron_jobs', (
    select jsonb_agg(
      jsonb_build_object(
        'jobname', j.jobname,
        'schedule', j.schedule,
        'command', j.command,
        'active', j.active
      )
      order by j.jobname
    )
    from cron.job j
    where j.jobname in ('lf-invitation-expiry', 'lf-draft-cleanup')
  ),
  'cron_counts', (
    select jsonb_object_agg(x.jobname, x.job_count)
    from (
      select j.jobname, count(*)::int as job_count
      from cron.job j
      where j.jobname in ('lf-invitation-expiry', 'lf-draft-cleanup')
      group by j.jobname
    ) x
  ),
  'public_tables_without_rls', (
    select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  'active_boundary_policy_count', (
    select count(*)::int
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and p.polname = 'active account boundary'
      and not p.polpermissive
  ),
  'batch_acl', (
    select jsonb_agg(
      jsonb_build_object(
        'function', p.proname,
        'public', pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'),
        'anon', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
        'authenticated', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        'service_role', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'),
        'security_definer', p.prosecdef,
        'search_path', p.proconfig
      )
      order by p.proname
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('lf_expire_invitations', 'lf_prepare_draft_cleanup')
  )
) as verification;
