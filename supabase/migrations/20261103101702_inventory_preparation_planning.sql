begin;
set local lock_timeout='3s';
create table public.inventory_recipe_yields(
 id uuid primary key, branch_id uuid not null references public.branches(id), recipe_id uuid not null references public.inventory_recipe_versions(id),
 output_qty numeric not null check(output_qty>0 and output_qty<1e9), output_unit text not null check(output_unit in('kg','l','pcs')),
 losses jsonb not null check(jsonb_typeof(losses)='array'), confirmed boolean not null, note text not null check(length(note)<=1000),
 created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp()
);
create table public.inventory_preparation_plans(
 id uuid primary key, branch_id uuid not null references public.branches(id), yield_id uuid not null references public.inventory_recipe_yields(id), plan_date date not null,
 target_qty numeric not null check(target_qty>=0 and target_qty<1e9), reserve_qty numeric not null check(reserve_qty>=0 and reserve_qty<1e9),
 usable_qty numeric not null check(usable_qty>=0 and usable_qty<1e9), incoming_qty numeric not null check(incoming_qty>=0 and incoming_qty<1e9),
 created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp()
);
create index inventory_recipe_yields_branch on public.inventory_recipe_yields(branch_id,created_at desc);
create index inventory_preparation_plans_day on public.inventory_preparation_plans(branch_id,plan_date,created_at desc);
alter table public.inventory_recipe_yields enable row level security;
alter table public.inventory_preparation_plans enable row level security;
revoke all on public.inventory_recipe_yields,public.inventory_preparation_plans from public,anon,authenticated;
grant select on public.inventory_recipe_yields,public.inventory_preparation_plans to authenticated;
create policy recipe_yields_read on public.inventory_recipe_yields for select to authenticated using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active' and role in('manager','branch_owner','brand_owner','super_admin')));
create policy preparation_plans_read on public.inventory_preparation_plans for select to authenticated using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active' and role in('manager','branch_owner','brand_owner','super_admin')));

create function private.require_preparation_manager(p_branch uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.users where id=auth.uid() and status='active' and role in('manager','branch_owner','brand_owner','super_admin')) or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'Preparation access denied' using errcode='42501'; end if;
end $$;
revoke all on function private.require_preparation_manager(uuid) from public,anon,authenticated;

create function private.save_inventory_recipe_yield(p_branch uuid,p_id uuid,p_recipe uuid,p_output numeric,p_unit text,p_losses jsonb,p_confirmed boolean,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare recipe public.inventory_recipe_versions%rowtype; old public.inventory_recipe_yields%rowtype; i integer; loss numeric;
begin
 perform private.require_preparation_manager(p_branch);
 if p_id is null or p_output is null or not(p_output>0 and p_output<1e9) or p_unit is null or p_unit not in('kg','l','pcs') or p_confirmed is null or p_note is null or length(p_note)>1000 or p_losses is null or jsonb_typeof(p_losses)<>'array' then raise exception 'Invalid preparation yield'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.inventory_recipe_yields where id=p_id;
 if found then
  if old.branch_id<>p_branch or old.created_by<>auth.uid() or old.recipe_id is distinct from p_recipe or old.output_qty<>p_output or old.output_unit<>p_unit or old.losses<>p_losses or old.confirmed<>p_confirmed or old.note<>p_note then raise exception 'Yield command conflict' using errcode='23505'; end if;
  return old.id;
 end if;
 select * into recipe from public.inventory_recipe_versions where id=p_recipe and branch_id=p_branch;
 if not found or jsonb_array_length(p_losses)<>jsonb_array_length(recipe.ingredients) then raise exception 'Recipe or losses unavailable'; end if;
 for i in 0..jsonb_array_length(p_losses)-1 loop
  if jsonb_typeof(p_losses->i)<>'number' then raise exception 'Invalid trimming quantity'; end if;
  loss:=(p_losses->>i)::numeric;
  if not(loss>=0 and loss<=(recipe.ingredients->i->>'qty')::numeric) then raise exception 'Invalid trimming quantity'; end if;
 end loop;
 insert into public.inventory_recipe_yields(id,branch_id,recipe_id,output_qty,output_unit,losses,confirmed,note,created_by) values(p_id,p_branch,p_recipe,p_output,p_unit,p_losses,p_confirmed,p_note,auth.uid());
 return p_id;
end $$;
revoke all on function private.save_inventory_recipe_yield(uuid,uuid,uuid,numeric,text,jsonb,boolean,text) from public,anon;
grant execute on function private.save_inventory_recipe_yield(uuid,uuid,uuid,numeric,text,jsonb,boolean,text) to authenticated;
create function public.save_inventory_recipe_yield(p_branch uuid,p_id uuid,p_recipe uuid,p_output numeric,p_unit text,p_losses jsonb,p_confirmed boolean,p_note text) returns uuid language sql security invoker set search_path='' as $$select private.save_inventory_recipe_yield(p_branch,p_id,p_recipe,p_output,p_unit,p_losses,p_confirmed,p_note)$$;
revoke all on function public.save_inventory_recipe_yield(uuid,uuid,uuid,numeric,text,jsonb,boolean,text) from public,anon;
grant execute on function public.save_inventory_recipe_yield(uuid,uuid,uuid,numeric,text,jsonb,boolean,text) to authenticated;

create function private.save_inventory_preparation_plan(p_branch uuid,p_id uuid,p_yield uuid,p_date date,p_target numeric,p_reserve numeric,p_usable numeric,p_incoming numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare y public.inventory_recipe_yields%rowtype; old public.inventory_preparation_plans%rowtype;
begin
 perform private.require_preparation_manager(p_branch);
 if p_id is null or p_date is null or not(p_date between date '2000-01-01' and date '2100-12-31') or p_target is null or not(p_target>=0 and p_target<1e9) or p_reserve is null or not(p_reserve>=0 and p_reserve<1e9) or p_usable is null or not(p_usable>=0 and p_usable<1e9) or p_incoming is null or not(p_incoming>=0 and p_incoming<1e9) then raise exception 'Invalid preparation plan'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.inventory_preparation_plans where id=p_id;
 if found then
  if old.branch_id<>p_branch or old.created_by<>auth.uid() or old.yield_id is distinct from p_yield or old.plan_date<>p_date or old.target_qty<>p_target or old.reserve_qty<>p_reserve or old.usable_qty<>p_usable or old.incoming_qty<>p_incoming then raise exception 'Plan command conflict' using errcode='23505'; end if;
  return old.id;
 end if;
 select * into y from public.inventory_recipe_yields where id=p_yield and branch_id=p_branch and confirmed;
 if not found then raise exception 'Confirmed branch recipe yield required'; end if;
 if ceil(greatest(0,p_target+p_reserve-p_usable-p_incoming)/y.output_qty)>1e6 then raise exception 'Preparation plan too large'; end if;
 insert into public.inventory_preparation_plans(id,branch_id,yield_id,plan_date,target_qty,reserve_qty,usable_qty,incoming_qty,created_by) values(p_id,p_branch,p_yield,p_date,p_target,p_reserve,p_usable,p_incoming,auth.uid());
 return p_id;
end $$;
revoke all on function private.save_inventory_preparation_plan(uuid,uuid,uuid,date,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function private.save_inventory_preparation_plan(uuid,uuid,uuid,date,numeric,numeric,numeric,numeric) to authenticated;
create function public.save_inventory_preparation_plan(p_branch uuid,p_id uuid,p_yield uuid,p_date date,p_target numeric,p_reserve numeric,p_usable numeric,p_incoming numeric) returns uuid language sql security invoker set search_path='' as $$select private.save_inventory_preparation_plan(p_branch,p_id,p_yield,p_date,p_target,p_reserve,p_usable,p_incoming)$$;
revoke all on function public.save_inventory_preparation_plan(uuid,uuid,uuid,date,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.save_inventory_preparation_plan(uuid,uuid,uuid,date,numeric,numeric,numeric,numeric) to authenticated;
commit;
