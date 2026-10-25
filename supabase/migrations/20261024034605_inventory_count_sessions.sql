begin;
set local lock_timeout = '3s';

create table public.inventory_count_sessions (
  id uuid primary key,
  branch_id uuid not null references public.branches(id),
  count_date date not null,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  revision integer not null default 0,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_by uuid references public.users(id),
  completed_at timestamptz
);
create unique index inventory_one_open_count on public.inventory_count_sessions(branch_id) where status='draft';
create index inventory_count_sessions_branch on public.inventory_count_sessions(branch_id,created_at desc);
create table public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_count_sessions(id),
  product_id uuid not null references public.inventory_master(id),
  product text not null,
  category text not null,
  unit text,
  target numeric not null check (target>=0 and target<'Infinity'::numeric),
  quantity numeric check (quantity>=0 and quantity<'Infinity'::numeric),
  baseline_fingerprint text not null,
  unique(session_id,product_id)
);
create table public.inventory_count_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_count_sessions(id),
  actor_id uuid not null references public.users(id),
  action text not null check(action in ('start','save','complete','cancel')),
  revision integer not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,revision)
);
alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_lines enable row level security;
alter table public.inventory_count_session_events enable row level security;
revoke all on public.inventory_count_sessions,public.inventory_count_lines,public.inventory_count_session_events from public,anon,authenticated;
grant select on public.inventory_count_sessions,public.inventory_count_lines,public.inventory_count_session_events to authenticated;
create policy count_sessions_read on public.inventory_count_sessions for select to authenticated
  using (public.is_manager() and exists(select 1 from public.users u where u.id=(select auth.uid()) and u.status='active') and branch_id in (select public.accessible_branch_ids()));
create policy count_lines_read on public.inventory_count_lines for select to authenticated
  using (exists(select 1 from public.inventory_count_sessions s where s.id=session_id));
create policy count_events_read on public.inventory_count_session_events for select to authenticated
  using (exists(select 1 from public.inventory_count_sessions s where s.id=session_id));

-- Only this checked transaction may mutate drafts. Direct table writes are revoked.
-- Definer is confined to private schema; the public RPC wrapper is an invoker.
create or replace function private.edit_inventory_count(p_branch uuid,p_id uuid,p_action text,p_revision integer,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare s public.inventory_count_sessions%rowtype; actor uuid:=auth.uid(); actor_name text; line_count integer;
begin
  if actor is null or not public.is_manager() or not exists(select 1 from public.users where id=actor and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch)
    then raise exception 'Count access denied' using errcode='42501'; end if;
  if p_id is null or p_action is null or p_action not in ('start','save','complete','cancel') then raise exception 'Invalid count action'; end if;
  -- Serialize start/retries for this branch, including absence of a session row.
  perform pg_advisory_xact_lock(hashtextextended('inventory-count:'||p_branch::text,0));
  select * into s from public.inventory_count_sessions where id=p_id for update;
  if p_action='start' then
    if found then
      if s.branch_id<>p_branch then raise exception 'Count access denied' using errcode='42501'; end if;
      return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status);
    end if;
    select * into s from public.inventory_count_sessions where branch_id=p_branch and status='draft' for update;
    if found then return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status); end if;
    insert into public.inventory_count_sessions(id,branch_id,count_date,created_by)
      values(p_id,p_branch,(now() at time zone 'Europe/Berlin')::date,actor) returning * into s;
    insert into public.inventory_count_lines(session_id,product_id,product,category,unit,target,baseline_fingerprint)
      select s.id,m.id,m.product,m.category,m.unit,m.soll,
        (select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by c.id),'')) from public.inventory_counts c where c.branch_id=p_branch and c.count_date=s.count_date
          and c.product=m.product and coalesce(c.category,'')=coalesce(m.category,'') and coalesce(c.unit,'')=coalesce(m.unit,'')
        )
      from public.inventory_master m where m.branch_id=p_branch and m.is_active;
    get diagnostics line_count=row_count;
    if line_count=0 then raise exception 'No active products to count'; end if;
    insert into public.inventory_count_session_events(session_id,actor_id,action,revision) values(s.id,actor,'start',0);
    return jsonb_build_object('id',s.id,'revision',0,'status','draft');
  end if;
  if s.id is null or s.branch_id<>p_branch then raise exception 'Count access denied' using errcode='42501'; end if;
  -- Completion retry is safe even when its response was lost.
  if p_action='complete' and s.status='completed' then return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status); end if;
  if s.status<>'draft' then raise exception 'Count is closed'; end if;
  if p_revision is distinct from s.revision then raise exception 'Count changed. Reload before saving.' using errcode='40001'; end if;
  if p_action='save' then
    if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>5000 then raise exception 'Invalid count lines'; end if;
    if exists(select 1 from jsonb_array_elements(p_lines) x where jsonb_typeof(x) is distinct from 'object'
      or not(x ? 'id') or not(x ? 'quantity') or jsonb_typeof(x->'id') is distinct from 'string'
      or jsonb_typeof(x->'quantity') not in ('number','null')) then raise exception 'Invalid count lines'; end if;
    if (select count(*) from jsonb_array_elements(p_lines))<>(select count(distinct x->>'id') from jsonb_array_elements(p_lines) x)
      or exists(select 1 from jsonb_array_elements(p_lines) x where not exists(select 1 from public.inventory_count_lines l where l.id=(x->>'id')::uuid and l.session_id=s.id))
      then raise exception 'Invalid count line identity'; end if;
    update public.inventory_count_lines l set quantity=(x->>'quantity')::numeric
      from jsonb_array_elements(p_lines) x where l.session_id=s.id and l.id=(x->>'id')::uuid;
  elsif p_action='complete' then
    if not exists(select 1 from public.inventory_count_lines where session_id=s.id)
      or exists(select 1 from public.inventory_count_lines where session_id=s.id and quantity is null) then raise exception 'Count every product before completing'; end if;
    -- ponytail: short table lock covers legacy writers; migrate all writers to branch locks before removing it.
    lock table public.inventory_counts in share row exclusive mode;
    lock table public.inventory_master in share mode;
    if exists(select 1 from public.inventory_count_lines l left join public.inventory_master m on m.id=l.product_id
      where l.session_id=s.id and (m.id is null or not m.is_active or m.branch_id<>p_branch
        or m.product is distinct from l.product or m.category is distinct from l.category or m.unit is distinct from l.unit or m.soll is distinct from l.target))
      or exists(select 1 from public.inventory_master m where m.branch_id=p_branch and m.is_active and not exists(select 1 from public.inventory_count_lines l where l.session_id=s.id and l.product_id=m.id))
      then raise exception 'Catalogue changed. Cancel this draft and start a new count.' using errcode='40001'; end if;
    if exists(select 1 from public.inventory_count_lines l where l.session_id=s.id and l.baseline_fingerprint is distinct from
      (select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by c.id),'')) from public.inventory_counts c where c.branch_id=p_branch and c.count_date=s.count_date and c.product=l.product
        and coalesce(c.category,'')=coalesce(l.category,'') and coalesce(c.unit,'')=coalesce(l.unit,'')))
      then raise exception 'Published counts changed. Cancel this draft and start again.' using errcode='40001'; end if;
    select full_name into actor_name from public.users where id=actor;
    insert into public.inventory_counts(branch_id,count_date,product,category,unit,ist,soll,counted_by)
      select p_branch,s.count_date,product,category,unit,quantity,target,coalesce(actor_name,'Manager') from public.inventory_count_lines where session_id=s.id;
    -- Existing stock_event_capture triggers append the published stock evidence.
  end if;
  update public.inventory_count_sessions set revision=revision+1,updated_at=now(),
    status=case p_action when 'complete' then 'completed' when 'cancel' then 'cancelled' else 'draft' end,
    completed_by=case when p_action='complete' then actor end,completed_at=case when p_action='complete' then now() end
    where id=s.id returning * into s;
  insert into public.inventory_count_session_events(session_id,actor_id,action,revision,details)
    values(s.id,actor,p_action,s.revision,case when p_action='save' then p_lines else '{}'::jsonb end);
  return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status);
end $$;
revoke all on function private.edit_inventory_count(uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.edit_inventory_count(uuid,uuid,text,integer,jsonb) to authenticated;
create function public.edit_inventory_count(p_branch uuid,p_id uuid,p_action text,p_revision integer default 0,p_lines jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.edit_inventory_count(p_branch,p_id,p_action,p_revision,p_lines);
$$;
revoke all on function public.edit_inventory_count(uuid,uuid,text,integer,jsonb) from public,anon;
grant execute on function public.edit_inventory_count(uuid,uuid,text,integer,jsonb) to authenticated;
commit;
