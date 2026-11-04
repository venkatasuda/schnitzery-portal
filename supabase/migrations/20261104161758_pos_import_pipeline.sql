begin;
set local lock_timeout='3s';
create table public.pos_connections(id uuid primary key,branch_id uuid not null references public.branches(id),name text not null check(length(trim(name)) between 1 and 160),enabled boolean not null default false,created_by uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp());
create table public.pos_imports(id uuid primary key default gen_random_uuid(),connection_id uuid not null references public.pos_connections(id),branch_id uuid not null references public.branches(id),external_id text not null check(length(external_id) between 1 and 160),payload jsonb not null,status text not null default 'pending' check(status in('pending','approved','rejected')),received_at timestamptz not null default clock_timestamp(),reviewed_by uuid references public.users(id),reviewed_at timestamptz,review_note text,unique(connection_id,external_id));
create index pos_imports_branch on public.pos_imports(branch_id,received_at desc);
alter table public.pos_connections enable row level security;
alter table public.pos_imports enable row level security;
revoke all on public.pos_connections,public.pos_imports from public,anon,authenticated;
grant select on public.pos_connections,public.pos_imports to authenticated;
create policy pos_connections_read on public.pos_connections for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create policy pos_imports_read on public.pos_imports for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create function private.configure_pos_connection(p_branch uuid,p_id uuid,p_name text,p_enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'POS access denied' using errcode='42501';end if;
 if p_id is null or p_enabled is null or length(trim(coalesce(p_name,''))) not between 1 and 160 then raise exception 'Connection name required';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-branch:'||p_branch::text,0));
 if exists(select 1 from public.pos_connections where id=p_id and branch_id<>p_branch) then raise exception 'Connection unavailable' using errcode='42501';end if;
 insert into public.pos_connections(id,branch_id,name,enabled,created_by) values(p_id,p_branch,trim(p_name),p_enabled,auth.uid()) on conflict(id) do update set name=excluded.name,enabled=excluded.enabled;
 return p_id;
end $$;
revoke all on function private.configure_pos_connection(uuid,uuid,text,boolean) from public,anon,authenticated;
create function public.configure_pos_connection(p_branch uuid,p_id uuid,p_name text,p_enabled boolean) returns uuid language sql security invoker set search_path='' as $$select private.configure_pos_connection(p_branch,p_id,p_name,p_enabled)$$;
-- The public wrapper invokes only the checked private function.
grant usage on schema private to authenticated;
grant execute on function private.configure_pos_connection(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.configure_pos_connection(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.configure_pos_connection(uuid,uuid,text,boolean) to authenticated;

-- Called only after server-side HMAC validation; never exposed to authenticated clients.
create function private.stage_pos_import(p_connection uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.pos_connections%rowtype;old public.pos_imports%rowtype;r jsonb;result uuid;
begin
 select * into c from public.pos_connections where id=p_connection and enabled for share;
 if not found or not exists(select 1 from public.branches where id=c.branch_id and is_active) then raise exception 'POS connection disabled' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1048576 or coalesce(p_payload->>'format','')<>'schnitzery-pos-daily-v1' or coalesce(p_payload->>'currency','')<>'EUR' or jsonb_typeof(p_payload->'external_id') is distinct from 'string' or length(trim(p_payload->>'external_id')) not between 1 and 160 or jsonb_typeof(p_payload->'days') is distinct from 'array' or jsonb_array_length(p_payload->'days') not between 1 and 400 then raise exception 'Invalid normalized POS payload';end if;
 if (select count(*) from jsonb_array_elements(p_payload->'days'))<>(select count(distinct v->>'date') from jsonb_array_elements(p_payload->'days') v) then raise exception 'Duplicate sales date';end if;
 for r in select value from jsonb_array_elements(p_payload->'days') loop
  if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not((r->>'date')::date between date '2000-01-01' and (now() at time zone 'Europe/Berlin')::date) or jsonb_typeof(r->'gross_sales') is distinct from 'number' or not((r->>'gross_sales')::numeric between 0 and 10000000) or (r->>'gross_sales')::numeric<>round((r->>'gross_sales')::numeric,2) then raise exception 'Invalid daily gross sales';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('pos-branch:'||c.branch_id::text,0));
 select * into old from public.pos_imports where connection_id=p_connection and external_id=p_payload->>'external_id';
 if found then if old.payload<>p_payload then raise exception 'POS external ID conflict' using errcode='23505';end if;return old.id;end if;
 insert into public.pos_imports(connection_id,branch_id,external_id,payload) values(c.id,c.branch_id,p_payload->>'external_id',p_payload) returning id into result;return result;
end $$;
revoke all on function private.stage_pos_import(uuid,jsonb) from public,anon,authenticated;
create function public.stage_pos_import(p_connection uuid,p_payload jsonb) returns uuid language sql security definer set search_path='' as $$select private.stage_pos_import(p_connection,p_payload)$$;
revoke all on function public.stage_pos_import(uuid,jsonb) from public,anon,authenticated;
grant select on public.pos_connections,public.branches to service_role;
grant select on public.pos_imports to service_role;
grant execute on function public.stage_pos_import(uuid,jsonb) to service_role;
create function private.review_pos_import(p_branch uuid,p_id uuid,p_approve boolean,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.pos_imports%rowtype;day jsonb;
begin
 if auth.uid() is null or not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'POS access denied' using errcode='42501';end if;
 if p_approve is null or length(trim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'Review note required';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-branch:'||p_branch::text,0));
 select * into item from public.pos_imports where id=p_id and branch_id=p_branch for update;
 if not found then raise exception 'POS import unavailable' using errcode='42501';end if;
 if item.status<>'pending' then if item.status=(case when p_approve then 'approved' else 'rejected' end) then return item.id;end if;raise exception 'POS import already reviewed' using errcode='23505';end if;
 if p_approve then
  for day in select value from jsonb_array_elements(item.payload->'days') order by value->>'date' loop
   -- Never overwrite a manual entry or another till's totals without reconciliation.
   insert into public.daily_sales(branch_id,sale_date,amount) values(p_branch,(day->>'date')::date,(day->>'gross_sales')::numeric);
  end loop;
 end if;
 update public.pos_imports set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=p_id;
 return p_id;
end $$;
revoke all on function private.review_pos_import(uuid,uuid,boolean,text) from public,anon,authenticated;
create function public.review_pos_import(p_branch uuid,p_id uuid,p_approve boolean,p_note text) returns uuid language sql security definer set search_path='' as $$select private.review_pos_import(p_branch,p_id,p_approve,p_note)$$;
revoke all on function public.review_pos_import(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.review_pos_import(uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
