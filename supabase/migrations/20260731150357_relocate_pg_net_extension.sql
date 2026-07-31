-- Management API applied this migration as version 20260731150357.
-- Supabase Advisor requires third-party extensions outside public.
do $$
declare
  v_schema text;
begin
  select n.nspname
    into v_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_net';

  if v_schema = 'public' then
    if exists (select 1 from net.http_request_queue) then
      raise exception 'pg_net request queue is not empty';
    end if;

    drop extension if exists pg_net;
    drop schema if exists net;
    create extension pg_net with schema extensions;
  elsif v_schema is null
    and exists (
      select 1
        from pg_available_extensions
       where name = 'pg_net'
    ) then
    create extension pg_net with schema extensions;
  end if;
end;
$$;

select public.lf_schedule_evidence_purge();
