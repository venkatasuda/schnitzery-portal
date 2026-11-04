begin;
set local lock_timeout='3s';
create table public.inventory_price_imports (
 id uuid primary key, branch_id uuid not null references public.branches(id), name text not null check(length(name) between 1 and 160),
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 1 and 500),
 content_hash text not null, created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp(),
 unique(branch_id,content_hash)
);
create table public.inventory_price_versions (
 id uuid primary key, branch_id uuid not null references public.branches(id), product_id uuid not null references public.inventory_master(id),
 revision integer not null check(revision>0), product text not null, category text, unit text not null,
 pack_qty numeric not null check(pack_qty>0 and pack_qty<1e9), pack_price numeric not null check(pack_price>=0 and pack_price<1e9),
 basis text not null check(basis in('net','gross')), vat_pct numeric check(vat_pct between 0 and 100),
 net_unit_price numeric not null check(net_unit_price>=0 and net_unit_price<1e9), effective_date date not null check(isfinite(effective_date)),
 source text not null check(length(trim(source)) between 1 and 300), source_type text not null check(source_type in('invoice_reference','supplier_quote','online_estimate','manual')),
 note text not null check(length(trim(note)) between 3 and 2000), reference_import_id uuid references public.inventory_price_imports(id), reference_index integer,
 request jsonb not null, created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp(),
 unique(product_id,revision), check(basis<>'gross' or vat_pct is not null),
 check((reference_import_id is null and reference_index is null) or (reference_import_id is not null and reference_index>=0))
);
create index price_versions_branch on public.inventory_price_versions(branch_id,product_id,effective_date desc,revision desc);
alter table public.inventory_price_imports enable row level security;
alter table public.inventory_price_versions enable row level security;
revoke all on public.inventory_price_imports,public.inventory_price_versions from public,anon,authenticated;
grant select on public.inventory_price_imports,public.inventory_price_versions to authenticated;
create policy price_imports_read on public.inventory_price_imports for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create policy price_versions_read on public.inventory_price_versions for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));

create function private.require_price_manager(p_branch uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'Price access denied' using errcode='42501';end if;
end $$;
revoke all on function private.require_price_manager(uuid) from public,anon,authenticated;

create function private.import_inventory_prices(p_branch uuid,p_id uuid,p_name text,p_rows jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.inventory_price_imports%rowtype; row jsonb; result uuid;
begin
 perform private.require_price_manager(p_branch);
 if p_id is null or p_name is null or length(p_name) not between 1 and 160 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then raise exception 'Invalid reference import';end if;
 perform pg_advisory_xact_lock(hashtextextended('price-import:'||p_branch::text,0));
 select * into old from public.inventory_price_imports where id=p_id;
 if found then
  if old.branch_id<>p_branch or old.rows<>p_rows or old.name<>p_name then raise exception 'Import command conflict' using errcode='23505';end if;return old.id;
 end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(row) is distinct from 'object' or jsonb_typeof(row->'item') is distinct from 'string' or length(trim(row->>'item')) not between 1 and 160
   or jsonb_typeof(row->'source') is distinct from 'string' or length(trim(row->>'source')) not between 1 and 300
   or jsonb_typeof(row->'notes') is distinct from 'string' or length(row->>'notes')>2000 then raise exception 'Invalid reference row';end if;
  if jsonb_typeof(row->'article_no') is distinct from 'string' or length(row->>'article_no')>160 or jsonb_typeof(row->'pack_size') is distinct from 'string' or length(row->>'pack_size')>160 or jsonb_typeof(row->'bought_quantity') is distinct from 'string' or length(row->>'bought_quantity')>160
   or coalesce(row->>'kind','') not in('invoice_reference','supplier_quote','online_estimate','manual')
   or (row->>'basis' is not null and row->>'basis' not in('net','gross'))
   or (row->>'quote_qty' is not null and (jsonb_typeof(row->'quote_qty') is distinct from 'number' or not((row->>'quote_qty')::numeric>0 and (row->>'quote_qty')::numeric<1e9)))
   or (row->>'quote_unit' is not null and (jsonb_typeof(row->'quote_unit') is distinct from 'string' or length(row->>'quote_unit') not between 1 and 30))
   or (row->>'price' is not null and (jsonb_typeof(row->'price') is distinct from 'number' or not((row->>'price')::numeric>=0 and (row->>'price')::numeric<1e9)))
   or (row->>'line_total' is not null and (jsonb_typeof(row->'line_total') is distinct from 'number' or not((row->>'line_total')::numeric>=0 and (row->>'line_total')::numeric<1e9)))
   or (row->>'vat_pct' is not null and (jsonb_typeof(row->'vat_pct') is distinct from 'number' or not((row->>'vat_pct')::numeric between 0 and 100)))
   or (row->>'observed_date' is not null and (row->>'observed_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not((row->>'observed_date')::date between date '2000-01-01' and date '2100-12-31'))) then raise exception 'Invalid reference price metadata';end if;
 end loop;
 select id into result from public.inventory_price_imports where branch_id=p_branch and content_hash=md5(p_rows::text);
 if result is not null then return result;end if;
 insert into public.inventory_price_imports(id,branch_id,name,rows,content_hash,created_by) values(p_id,p_branch,p_name,p_rows,md5(p_rows::text),auth.uid());return p_id;
end $$;
revoke all on function private.import_inventory_prices(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.import_inventory_prices(p_branch uuid,p_id uuid,p_name text,p_rows jsonb) returns uuid language sql security definer set search_path='' as $$select private.import_inventory_prices(p_branch,p_id,p_name,p_rows)$$;
revoke all on function public.import_inventory_prices(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.import_inventory_prices(uuid,uuid,text,jsonb) to authenticated;

create function private.save_inventory_price(p_branch uuid,p_id uuid,p_product uuid,p_expected integer,p_body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.inventory_price_versions%rowtype; item public.inventory_master%rowtype; rev integer; quantity numeric; price numeric; vat numeric; net numeric; day date; source_id uuid; source_index integer;
begin
 perform private.require_price_manager(p_branch);
 if p_id is null or p_product is null or p_expected is null or p_expected<0 or jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>20000 or p_body->'reviewed' is distinct from 'true'::jsonb then raise exception 'Review price before saving';end if;
 perform pg_advisory_xact_lock(hashtextextended('price-command:'||p_id::text,0));
 select * into old from public.inventory_price_versions where id=p_id;
 if found then
  if old.branch_id<>p_branch or old.product_id<>p_product or old.request<>p_body or old.created_by<>auth.uid() then raise exception 'Price command conflict' using errcode='23505';end if;return old.id;
 end if;
 select * into item from public.inventory_master where id=p_product and branch_id=p_branch and is_active for update;
 if not found or nullif(trim(item.unit),'') is null then raise exception 'Active branch product and stock unit required';end if;
 select coalesce(max(revision),0) into rev from public.inventory_price_versions where product_id=p_product;
 if rev<>p_expected then raise exception 'Price changed; reload history' using errcode='23505';end if;
 quantity:=(p_body->>'pack_qty')::numeric;price:=(p_body->>'pack_price')::numeric;vat:=(p_body->>'vat_pct')::numeric;day:=(p_body->>'effective_date')::date;
 if jsonb_typeof(p_body->'pack_qty') is distinct from 'number' or jsonb_typeof(p_body->'pack_price') is distinct from 'number' or quantity is null or not(quantity>0 and quantity<1e9) or price is null or not(price>=0 and price<1e9) or (vat is not null and not(vat>=0 and vat<=100))
  or coalesce(p_body->>'basis','') not in('net','gross') or (p_body->>'basis'='gross' and vat is null) then raise exception 'Check price, stock quantity and VAT basis';end if;
 if day is null or not isfinite(day) or day not between date '2000-01-01' and date '2100-12-31' or coalesce(p_body->>'effective_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or length(trim(coalesce(p_body->>'source',''))) not between 1 and 300 or coalesce(p_body->>'source_type','') not in('invoice_reference','supplier_quote','online_estimate','manual') or length(trim(coalesce(p_body->>'note',''))) not between 3 and 2000 then raise exception 'Effective date, source and review note required';end if;
 source_id:=(p_body->>'reference_import_id')::uuid;source_index:=(p_body->>'reference_index')::integer;
 if source_id is not null then
  if source_index is null or source_index<0 or not exists(select 1 from public.inventory_price_imports where id=source_id and branch_id=p_branch and source_index<jsonb_array_length(rows)) then raise exception 'Reference unavailable in this branch' using errcode='42501';end if;
 elsif source_index is not null then raise exception 'Reference import required';end if;
 net:=price/quantity; if p_body->>'basis'='gross' then net:=net/(1+vat/100);end if;
 if not(net>=0 and net<1e9) then raise exception 'Unit price out of range';end if;
 insert into public.inventory_price_versions(id,branch_id,product_id,revision,product,category,unit,pack_qty,pack_price,basis,vat_pct,net_unit_price,effective_date,source,source_type,note,reference_import_id,reference_index,request,created_by)
 values(p_id,p_branch,p_product,rev+1,item.product,item.category,item.unit,quantity,price,p_body->>'basis',vat,net,day,trim(p_body->>'source'),p_body->>'source_type',trim(p_body->>'note'),source_id,source_index,p_body,auth.uid());return p_id;
end $$;
revoke all on function private.save_inventory_price(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated;
create function public.save_inventory_price(p_branch uuid,p_id uuid,p_product uuid,p_expected integer,p_body jsonb) returns uuid language sql security definer set search_path='' as $$select private.save_inventory_price(p_branch,p_id,p_product,p_expected,p_body)$$;
revoke all on function public.save_inventory_price(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_inventory_price(uuid,uuid,uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
