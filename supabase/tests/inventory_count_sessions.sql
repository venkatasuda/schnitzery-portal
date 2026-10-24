-- Run ONLY on isolated local staging after migrations. Fixtures and evidence roll back.
\set ON_ERROR_STOP on
begin;
create temp table count_fixture(branch uuid,other_branch uuid,manager uuid,staff uuid,session uuid);
insert into count_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on count_fixture to authenticated;
insert into public.branches(id,name) select branch,'Count test A' from count_fixture union all select other_branch,'Count test B' from count_fixture;
insert into auth.users(id,email) select manager,manager::text||'@count.example.invalid' from count_fixture union all select staff,staff::text||'@count.example.invalid' from count_fixture;
insert into public.users(id,branch_id,role,status,full_name)
 select manager,branch,'manager','active','Synthetic count manager' from count_fixture union all select staff,branch,'staff','active','Synthetic count staff' from count_fixture
 on conflict(id) do update set branch_id=excluded.branch_id,role=excluded.role,status=excluded.status;
insert into public.inventory_master(branch_id,category,product,soll,unit) select branch,'Test','Rice',2,'kg' from count_fixture union all select branch,'Test','Water',5,'l' from count_fixture;
select set_config('request.jwt.claim.sub',manager::text,true) from count_fixture;
set local role authenticated;
do $$
declare f record; r jsonb; payload jsonb; n integer;
begin
 select * into f from count_fixture;
 r:=public.edit_inventory_count(f.branch,f.session,'start');
 if r->>'status'<>'draft' then raise exception 'Start failed'; end if;
 if (select count(*) from public.inventory_count_lines where session_id=f.session)<>2 then raise exception 'Snapshot incomplete'; end if;
 r:=public.edit_inventory_count(f.branch,gen_random_uuid(),'start');
 if r->>'id'<>f.session::text then raise exception 'Resume failed'; end if;
 begin
   perform public.edit_inventory_count(f.other_branch,gen_random_uuid(),'start');
   raise exception 'Cross branch allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.inventory_count_sessions set status='completed' where id=f.session;
   raise exception 'Direct write allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'complete',0);
   raise exception 'Incomplete count published';
 exception when raise_exception then if sqlerrm='Incomplete count published' then raise; end if; end;
 select jsonb_agg(jsonb_build_object('id',id,'quantity',case when product='Rice' then 0 else 2.5 end)) into payload from public.inventory_count_lines where session_id=f.session;
 perform public.edit_inventory_count(f.branch,f.session,'save',0,payload);
 if exists(select 1 from public.inventory_counts where branch_id=f.branch) then raise exception 'Draft affected stock'; end if;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'save',0,payload);
   raise exception 'Stale save accepted';
 exception when serialization_failure then null; end;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'save',1,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'quantity',3)));
   raise exception 'Foreign line accepted';
 exception when raise_exception then if sqlerrm='Foreign line accepted' then raise; end if; end;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'save',1,jsonb_build_array(jsonb_build_object('id',payload->0->>'id','quantity',-1)));
   raise exception 'Negative quantity accepted';
 exception when check_violation then null; end;
 perform public.edit_inventory_count(f.branch,f.session,'complete',1);
 perform public.edit_inventory_count(f.branch,f.session,'complete',1);
 select count(*) into n from public.inventory_counts where branch_id=f.branch;
 if n<>2 then raise exception 'Completion duplicated or lost rows: %',n; end if;
 if (select count(*) from public.stock_events where source_table='inventory_counts' and operation='INSERT' and f.branch=any(branch_ids))<>2 then raise exception 'Published stock evidence missing'; end if;
 if not exists(select 1 from public.inventory_counts where branch_id=f.branch and ist=0) then raise exception 'Explicit zero lost'; end if;
 if (select count(*) from public.inventory_count_session_events where session_id=f.session)<>3 then raise exception 'Audit events incomplete'; end if;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'save',2,payload);
   raise exception 'Closed session edited';
 exception when raise_exception then if sqlerrm='Closed session edited' then raise; end if; end;
 raise notice 'PASS: resume, scope, direct-write denial, completeness, draft isolation, revisions, identity, numeric checks, exactly-once completion and audit';
end $$;
reset role;
-- A quick count published after a draft starts must prevent its completion.
update count_fixture set session=gen_random_uuid();
set local role authenticated;
do $$ declare f record; payload jsonb; begin
 select * into f from count_fixture;
 perform public.edit_inventory_count(f.branch,f.session,'start');
 select jsonb_agg(jsonb_build_object('id',id,'quantity',3)) into payload from public.inventory_count_lines where session_id=f.session;
 perform public.edit_inventory_count(f.branch,f.session,'save',0,payload);
end $$;
reset role;
insert into public.inventory_counts(branch_id,count_date,category,product,unit,ist,soll)
 select branch,(now() at time zone 'Europe/Berlin')::date,'Test','Rice','kg',10,2 from count_fixture;
set local role authenticated;
do $$ declare f record; begin
 select * into f from count_fixture;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'complete',1);
   raise exception 'Competing published count ignored';
 exception when serialization_failure then null; end;
 if (select count(*) from public.inventory_counts where branch_id=f.branch)<>3 then raise exception 'Failed completion leaked writes'; end if;
 perform public.edit_inventory_count(f.branch,f.session,'cancel',1);
 raise notice 'PASS: competing publication, atomic rollback and cancellation';
end $$;
reset role;
-- Catalogue changes require a new snapshot rather than silently changing its scope.
update count_fixture set session=gen_random_uuid();
set local role authenticated;
do $$ declare f record; payload jsonb; begin
 select * into f from count_fixture;
 perform public.edit_inventory_count(f.branch,f.session,'start');
 select jsonb_agg(jsonb_build_object('id',id,'quantity',3)) into payload from public.inventory_count_lines where session_id=f.session;
 perform public.edit_inventory_count(f.branch,f.session,'save',0,payload);
end $$;
reset role;
update public.inventory_master set soll=99 where branch_id=(select branch from count_fixture) and product='Rice';
set local role authenticated;
do $$ declare f record; begin
 select * into f from count_fixture;
 begin
   perform public.edit_inventory_count(f.branch,f.session,'complete',1);
   raise exception 'Catalogue conflict ignored';
 exception when serialization_failure then null; end;
 raise notice 'PASS: catalogue conflict';
end $$;
reset role;
-- Staff cannot see the draft or invoke the private mutation directly.
select set_config('request.jwt.claim.sub',staff::text,true) from count_fixture;
set local role authenticated;
do $$ declare f record; begin
 select * into f from count_fixture;
 if exists(select 1 from public.inventory_count_sessions) then raise exception 'Staff can read sessions'; end if;
 if exists(select 1 from public.inventory_count_lines) then raise exception 'Staff can read count lines'; end if;
 begin
   perform private.edit_inventory_count(f.branch,gen_random_uuid(),'start',0,'[]');
   raise exception 'Staff can invoke count mutation';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: staff read and mutation denial';
end $$;
reset role;
-- Disabled managers cannot mutate drafts through either RPC path.
update public.users set status='inactive' where id=(select manager from count_fixture);
select set_config('request.jwt.claim.sub',manager::text,true) from count_fixture;
set local role authenticated;
do $$ declare f record; begin
 select * into f from count_fixture;
 if exists(select 1 from public.inventory_count_sessions) then raise exception 'Inactive manager can read sessions'; end if;
 begin
   perform public.edit_inventory_count(f.branch,gen_random_uuid(),'start');
   raise exception 'Inactive manager allowed';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: inactive manager mutation denial';
end $$;
reset role;
rollback;
