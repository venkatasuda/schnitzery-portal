begin;
set local lock_timeout='3s';
create table public.inventory_batch_net_costs (
 id uuid primary key,branch_id uuid not null references public.branches(id),batch_id uuid not null references public.stock_batches(id),
 revision integer not null check(revision>0),net_unit_cost numeric not null check(net_unit_cost>=0 and net_unit_cost<1e9),
 reference text not null check(length(trim(reference)) between 3 and 300),note text not null check(length(trim(note)) between 3 and 1000),
 actor_id uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp(),unique(batch_id,revision)
);
create table public.inventory_valuation_closes (
 id uuid primary key,branch_id uuid not null references public.branches(id),snapshot jsonb not null,note text not null check(length(trim(note)) between 3 and 1000),
 actor_id uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp()
);
create index batch_net_costs_branch on public.inventory_batch_net_costs(branch_id,batch_id,revision desc);
create index valuation_closes_branch on public.inventory_valuation_closes(branch_id,created_at desc);
alter table public.inventory_batch_net_costs enable row level security;
alter table public.inventory_valuation_closes enable row level security;
revoke all on public.inventory_batch_net_costs,public.inventory_valuation_closes from public,anon,authenticated;
grant select on public.inventory_batch_net_costs,public.inventory_valuation_closes to authenticated;
create policy net_costs_read on public.inventory_batch_net_costs for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create policy valuation_closes_read on public.inventory_valuation_closes for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create trigger net_costs_immutable before update or delete on public.inventory_batch_net_costs for each row execute function private.stock_events_immutable();
create trigger valuation_closes_immutable before update or delete on public.inventory_valuation_closes for each row execute function private.stock_events_immutable();

create function private.review_batch_net_cost(p_branch uuid,p_id uuid,p_batch uuid,p_expected integer,p_cost numeric,p_reference text,p_note text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.inventory_batch_net_costs%rowtype;rev integer;
begin
 perform private.require_price_manager(p_branch);
 if p_id is null or p_reviewed is distinct from true or p_expected is null or p_expected<0 or p_cost is null or not(p_cost>=0 and p_cost<1e9) or p_reference is null or length(trim(p_reference)) not between 3 and 300 or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Confirm net cost, invoice and review note';end if;
 perform 1 from public.stock_batches where id=p_batch and branch_id=p_branch for update;
 if not found then raise exception 'Batch access denied' using errcode='42501';end if;
 select * into old from public.inventory_batch_net_costs where id=p_id;
 if found then if row(old.branch_id,old.batch_id,old.revision,old.net_unit_cost,old.reference,old.note,old.actor_id) is distinct from row(p_branch,p_batch,p_expected+1,p_cost,trim(p_reference),trim(p_note),auth.uid()) then raise exception 'Cost retry conflict' using errcode='23505';end if;return old.id;end if;
 select coalesce(max(revision),0) into rev from public.inventory_batch_net_costs where batch_id=p_batch;
 if rev<>p_expected then raise exception 'Cost changed; refresh' using errcode='23505';end if;
 insert into public.inventory_batch_net_costs(id,branch_id,batch_id,revision,net_unit_cost,reference,note,actor_id) values(p_id,p_branch,p_batch,rev+1,p_cost,trim(p_reference),trim(p_note),auth.uid());return p_id;
end $$;

create function private.inventory_valuation_preview(p_branch uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare lines jsonb;unreconciled jsonb;missing integer;total numeric;
begin
 perform private.require_price_manager(p_branch);
 with balances as (
  select b.id as source_id,b.id as batch_id,'on_hand'::text as kind,b.product,b.category,b.unit,b.remaining_qty as qty from public.stock_batches b where b.branch_id=p_branch and b.status='active'
  union all
  select l.id,l.source_batch_id,'in_transit',l.product,l.category,l.unit,l.sent_qty from public.inventory_transfer_lots l join public.stock_transfers t on t.id=l.transfer_id where l.from_branch_id=p_branch and t.status='sent'
 ),costed as (
  select b.*,c.id as cost_review_id,c.revision as cost_revision,c.net_unit_cost,round(b.qty*c.net_unit_cost,2) as value_net from balances b left join lateral(select id,revision,net_unit_cost from public.inventory_batch_net_costs where batch_id=b.batch_id and branch_id=p_branch order by revision desc limit 1)c on true
 ) select coalesce(jsonb_agg(to_jsonb(c) order by kind,product,source_id),'[]'),count(*) filter(where net_unit_cost is null),coalesce(sum(value_net),0) into lines,missing,total from costed c;
 with identities as (
  select product,coalesce(category,'') category,lower(trim(coalesce(unit,''))) unit from public.inventory_master where branch_id=p_branch and is_active
  union select product,coalesce(category,''),lower(trim(coalesce(unit,''))) from public.stock_batches where branch_id=p_branch and status='active'
 ),counts as (
  select distinct on(product,coalesce(category,''),lower(trim(coalesce(unit,'')))) product,coalesce(category,'') category,lower(trim(coalesce(unit,''))) unit,ist,count_date from public.inventory_counts where branch_id=p_branch and count_date<=(now() at time zone 'Europe/Berlin')::date order by product,coalesce(category,''),lower(trim(coalesce(unit,''))),count_date desc,created_at desc,id desc
 ),checked as (
  select i.*,c.ist,c.count_date,(select coalesce(sum(b.remaining_qty),0) from public.stock_batches b where b.branch_id=p_branch and b.status='active' and b.product=i.product and coalesce(b.category,'')=i.category and lower(trim(coalesce(b.unit,'')))=i.unit) as tracked_qty from identities i left join counts c using(product,category,unit)
 ) select coalesce(jsonb_agg(to_jsonb(c)),'[]') into unreconciled from checked c where c.ist is null or c.count_date<>(now() at time zone 'Europe/Berlin')::date or c.ist<>c.tracked_qty;
 return jsonb_build_object('captured_at',clock_timestamp(),'method','reviewed_net_batch_cost','currency','EUR','lines',lines,'total_net',round(total,2),'unpriced',missing,'unreconciled',unreconciled,'complete',missing=0 and jsonb_array_length(unreconciled)=0 and exists(select 1 from public.inventory_counts where branch_id=p_branch and count_date=(now() at time zone 'Europe/Berlin')::date));
end $$;
create function private.close_inventory_valuation(p_branch uuid,p_id uuid,p_note text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare old public.inventory_valuation_closes%rowtype;snapshot jsonb;
begin
 perform private.require_price_manager(p_branch);
 if p_id is null or p_reviewed is distinct from true or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Confirm reconciliation and note';end if;
 perform pg_advisory_xact_lock(hashtextextended('valuation-close:'||p_id::text,0));
 select * into old from public.inventory_valuation_closes where id=p_id;
 if found then if old.branch_id<>p_branch or old.note<>trim(p_note) or old.actor_id<>auth.uid() then raise exception 'Close retry conflict' using errcode='23505';end if;return p_id;end if;
 -- ponytail: short share locks freeze phantoms across related tables; use a branch ledger for high-volume closing.
 lock table public.stock_batches,public.inventory_counts,public.inventory_master,public.stock_transfers,public.inventory_transfer_lots,public.inventory_batch_net_costs in share mode;
 snapshot:=private.inventory_valuation_preview(p_branch);
 if not(snapshot->>'complete')::boolean then raise exception 'Confirm all net costs and reconcile today physical counts to batches before closing' using errcode='23505';end if;
 insert into public.inventory_valuation_closes(id,branch_id,snapshot,note,actor_id) values(p_id,p_branch,snapshot,trim(p_note),auth.uid());return p_id;
end $$;
revoke all on function private.review_batch_net_cost(uuid,uuid,uuid,integer,numeric,text,text,boolean),private.inventory_valuation_preview(uuid),private.close_inventory_valuation(uuid,uuid,text,boolean) from public,anon,authenticated;
create function public.review_batch_net_cost(p_branch uuid,p_id uuid,p_batch uuid,p_expected integer,p_cost numeric,p_reference text,p_note text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.review_batch_net_cost(p_branch,p_id,p_batch,p_expected,p_cost,p_reference,p_note,p_reviewed)$$;
create function public.inventory_valuation_preview(p_branch uuid) returns jsonb language sql security invoker set search_path='' as $$select private.inventory_valuation_preview(p_branch)$$;
create function public.close_inventory_valuation(p_branch uuid,p_id uuid,p_note text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.close_inventory_valuation(p_branch,p_id,p_note,p_reviewed)$$;
revoke all on function public.review_batch_net_cost(uuid,uuid,uuid,integer,numeric,text,text,boolean),public.inventory_valuation_preview(uuid),public.close_inventory_valuation(uuid,uuid,text,boolean) from public,anon;
grant execute on function private.review_batch_net_cost(uuid,uuid,uuid,integer,numeric,text,text,boolean),private.inventory_valuation_preview(uuid),private.close_inventory_valuation(uuid,uuid,text,boolean),public.review_batch_net_cost(uuid,uuid,uuid,integer,numeric,text,text,boolean),public.inventory_valuation_preview(uuid),public.close_inventory_valuation(uuid,uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
