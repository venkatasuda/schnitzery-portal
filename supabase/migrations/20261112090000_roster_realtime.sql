-- Live roster sync: send change events for the roster tables to subscribed clients.
-- Row-level security still applies to what each subscriber receives (drafts: managers of the branch;
-- published roster: staff of the branch). Idempotent; does nothing where Realtime is not installed.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['roster_drafts', 'weekly_roster'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
