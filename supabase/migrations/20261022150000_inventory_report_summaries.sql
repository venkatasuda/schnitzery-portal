-- Speed: the inventory report read a branch's ENTIRE count and purchase history on
-- every open (1,000 rows per round trip, sequentially) only to find
--   (a) the latest count per product, and
--   (b) the latest delivery price before the report window.
-- These two functions return just those rows. SECURITY INVOKER: the caller's RLS
-- policies on inventory_counts / inventory_purchases still decide what is visible.
begin;
set local lock_timeout = '3s';

-- (a) Latest count per identity — same identity as inventoryKey(): category, product, unit.
create function public.inventory_latest_counts(p_branch uuid)
returns table(product text, category text, unit text, ist numeric, count_date date)
language sql stable security invoker set search_path = '' as $$
  select distinct on (coalesce(c.category, ''), c.product, coalesce(c.unit, ''))
         c.product, c.category, c.unit, c.ist, c.count_date
  from public.inventory_counts c
  where c.branch_id = p_branch and c.count_date <= (now() at time zone 'Europe/Berlin')::date
  order by coalesce(c.category, ''), c.product, coalesce(c.unit, ''), c.count_date desc, c.created_at desc, c.id desc
$$;

-- (b) Per price identity (category, product, trimmed lower-case unit — as valuation.ts),
-- every usable delivery on the latest usable day before p_before. Together with the
-- deliveries from p_before onwards, latestPrice() gives exactly the full-history answer.
create function public.inventory_price_baseline(p_branch uuid, p_before date)
returns table(product text, category text, unit text, qty numeric, cost numeric, purchase_date date)
language sql stable security invoker set search_path = '' as $$
  with usable as (
    select p.product, p.category, p.unit, p.qty, p.cost, p.purchase_date,
           max(p.purchase_date) over (partition by coalesce(p.category, ''), p.product, lower(btrim(coalesce(p.unit, '')))) as last_day
    from public.inventory_purchases p
    where p.branch_id = p_branch and p.purchase_date < p_before
      and p.qty > 0 and p.qty <> 'NaN' and p.cost >= 0 and p.cost <> 'NaN'
  )
  select u.product, u.category, u.unit, u.qty, u.cost, u.purchase_date from usable u where u.purchase_date = u.last_day
$$;

revoke all on function public.inventory_latest_counts(uuid) from public, anon;
revoke all on function public.inventory_price_baseline(uuid, date) from public, anon;
grant execute on function public.inventory_latest_counts(uuid) to authenticated;
grant execute on function public.inventory_price_baseline(uuid, date) to authenticated;

-- Window reads filter counts by branch and date; only single-column indexes existed.
create index if not exists inventory_counts_branch_date_idx on public.inventory_counts (branch_id, count_date);
commit;
