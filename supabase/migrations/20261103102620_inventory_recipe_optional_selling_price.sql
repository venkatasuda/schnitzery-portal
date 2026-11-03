-- Kitchen preparation recipes may have an unknown selling price. Unknown is not zero.
begin;
alter table public.inventory_recipe_versions alter column net_price drop not null;
create or replace function private.save_inventory_recipe(p_branch uuid,p_id uuid,p_name text,p_portions numeric,p_net_price numeric,p_lines jsonb,p_prices_net_confirmed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item jsonb; product_row public.inventory_master%rowtype; canonical jsonb:='[]'::jsonb; quantity numeric; req jsonb; old public.inventory_recipe_versions%rowtype;
begin
 if actor is null or not exists(select 1 from public.users where id=actor and status='active' and role in('manager','branch_owner','brand_owner','super_admin')) or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'Recipe access denied' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 160 or p_portions is null or not(p_portions>0 and p_portions<1000000) or (p_net_price is not null and not(p_net_price>=0 and p_net_price<1000000)) or p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'Invalid recipe'; end if;
 if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Invalid recipe lines'; end if;
 req:=jsonb_build_object('name',trim(p_name),'portions',p_portions,'net_price',p_net_price,'lines',p_lines,'prices_net_confirmed',coalesce(p_prices_net_confirmed,false));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.inventory_recipe_versions where id=p_id;
 if found then
   if old.branch_id<>p_branch or old.created_by<>actor or old.request<>req then raise exception 'Recipe command conflict' using errcode='23505'; end if;
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
commit;
