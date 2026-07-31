-- J-08 requires pg_net to invoke the internal evidence purge Edge Function.
-- Filename matches the version assigned by the authenticated Management API deployment.

do $$
begin
  if not exists (
       select 1
         from pg_extension
        where extname = 'pg_net'
     )
     and exists (
       select 1
         from pg_available_extensions
        where name = 'pg_net'
     ) then
    execute 'create extension if not exists pg_net';
  end if;
end;
$$;

select public.lf_schedule_evidence_purge();
