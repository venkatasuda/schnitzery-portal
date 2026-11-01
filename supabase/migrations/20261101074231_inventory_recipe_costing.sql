begin;
set local lock_timeout='3s';
create table public.inventory_recipe_versions (
 id uuid primary key, branch_id uuid not null references public.branches(id),
 name text not null check(length(trim(name)) between 1 and 160),
 portions numeric not null check(portions>0 and portions<'Infinity'::numeric),
 net_price numeric not null check(net_price>=0 and net_price<'Infinity'::numeric), prices_net_confirmed boolean not null default false,
 ingredients jsonb not null check(jsonb_typeof(ingredients)='array' and jsonb_array_length(ingredients) between 1 and 100),
 request jsonb not null, created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp()
);
create index inventory_recipe_branch_date on public.inventory_recipe_versions(branch_id,created_at desc);
alter table public.inventory_recipe_versions enable row level security;
revoke all on public.inventory_recipe_versions from public,anon,authenticated;
grant select on public.inventory_recipe_versions to authenticated;
create policy recipe_versions_read on public.inventory_recipe_versions for select to authenticated
 using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active' and role in('manager','branch_owner','brand_owner','super_admin')));

create or replace function private.inventory_unit_qty(p_qty numeric,p_from text,p_to text) returns numeric
language plpgsql immutable set search_path='' as $$
declare f text:=lower(trim(p_from)); t text:=lower(trim(p_to)); fd text; td text; ff numeric; tf numeric;
begin
 if p_qty is null or not(p_qty>0 and p_qty<'Infinity'::numeric) or f is null or t is null or f='' or t='' then return null; end if;
 if f=t then return p_qty; end if;
 select dimension,factor into fd,ff from (values('g','mass',1::numeric),('kg','mass',1000),('ml','volume',1),('l','volume',1000),('pcs','count',1),('stk','count',1),('stk.','count',1),('piece','count',1)) as u(unit,dimension,factor) where unit=f;
 select dimension,factor into td,tf from (values('g','mass',1::numeric),('kg','mass',1000),('ml','volume',1),('l','volume',1000),('pcs','count',1),('stk','count',1),('stk.','count',1),('piece','count',1)) as u(unit,dimension,factor) where unit=t;
 if fd is null or td is null or fd<>td then return null; end if;
 return p_qty*ff/tf;
end $$;
revoke all on function private.inventory_unit_qty(numeric,text,text) from public,anon,authenticated;

create or replace function private.save_inventory_recipe(p_branch uuid,p_id uuid,p_name text,p_portions numeric,p_net_price numeric,p_lines jsonb,p_prices_net_confirmed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item jsonb; product_row public.inventory_master%rowtype; canonical jsonb:='[]'::jsonb; quantity numeric; req jsonb; old public.inventory_recipe_versions%rowtype;
begin
 if actor is null or not exists(select 1 from public.users where id=actor and status='active' and role in('manager','branch_owner','brand_owner','super_admin')) or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'Recipe access denied' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 160 or p_portions is null or not(p_portions>0 and p_portions<1000000) or p_net_price is null or not(p_net_price>=0 and p_net_price<1000000) or p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'Invalid recipe'; end if;
 if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Invalid recipe lines'; end if;
 req:=jsonb_build_object('name',trim(p_name),'portions',p_portions,'net_price',p_net_price,'lines',p_lines,'prices_net_confirmed',coalesce(p_prices_net_confirmed,false));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.inventory_recipe_versions where id=p_id;
 if found then
   if old.branch_id<>p_branch or old.created_by<>actor or old.request<>req then raise exception 'Recipe command conflict' using errcode='40001'; end if;
   return old.id;
 end if;
 for item in select value from jsonb_array_elements(p_lines) loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'qty') is distinct from 'number' then raise exception 'Invalid ingredient'; end if;
   select * into product_row from public.inventory_master where id=(item->>'product_id')::uuid and branch_id=p_branch and is_active for share;
   if not found then raise exception 'Ingredient not in active branch'; end if;
   quantity:=private.inventory_unit_qty((item->>'qty')::numeric,item->>'unit',product_row.unit);
   if quantity is null or not(quantity>0 and quantity<1000000000) then raise exception 'Unsupported ingredient conversion'; end if;
   canonical:=canonical||jsonb_build_array(jsonb_build_object('product_id',product_row.id,'product',product_row.product,'category',product_row.category,'unit',product_row.unit,'qty',quantity,'entered_qty',item->'qty','entered_unit',item->>'unit'));
 end loop;
 insert into public.inventory_recipe_versions(id,branch_id,name,portions,net_price,ingredients,request,created_by,prices_net_confirmed)
 values(p_id,p_branch,trim(p_name),p_portions,p_net_price,canonical,req,actor,coalesce(p_prices_net_confirmed,false));
 return p_id;
end $$;
revoke all on function private.save_inventory_recipe(uuid,uuid,text,numeric,numeric,jsonb,boolean) from public,anon;
grant execute on function private.save_inventory_recipe(uuid,uuid,text,numeric,numeric,jsonb,boolean) to authenticated;
create or replace function public.save_inventory_recipe(p_branch uuid,p_id uuid,p_name text,p_portions numeric,p_net_price numeric,p_lines jsonb,p_prices_net_confirmed boolean default false) returns uuid
language sql security invoker set search_path='' as $$ select private.save_inventory_recipe(p_branch,p_id,p_name,p_portions,p_net_price,p_lines,p_prices_net_confirmed) $$;
revoke all on function public.save_inventory_recipe(uuid,uuid,text,numeric,numeric,jsonb,boolean) from public,anon;
grant execute on function public.save_inventory_recipe(uuid,uuid,text,numeric,numeric,jsonb,boolean) to authenticated;
commit;
