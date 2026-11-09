-- STAGING ONLY: 6 weeks of sample prep history (sent lists + evening leftover counts) so the
-- target suggestions in Prep planning → Setup can be tested. Never run on production.
-- Run:  set seed.staging = 'yes';  (optional) set seed.branch = 'Schnitzery Stuttgart';  then this file.
-- Existing lists/counts are kept (on conflict do nothing). Daily use = 75–105 % of the weekday "up to" target.
do $$
declare b uuid; it record; d date; wd int; start_qty numeric; prep numeric; use_qty numeric; end_qty numeric; list uuid;
begin
  if coalesce(current_setting('seed.staging', true), '') <> 'yes' then raise exception 'Staging only: run "set seed.staging = ''yes'';" first'; end if;
  -- seed.branch if set; otherwise the branch with the most active prep items.
  if nullif(current_setting('seed.branch', true), '') is not null then
    select id into b from public.branches where name = current_setting('seed.branch', true);
  else
    select branch_id into b from public.prep_items where is_active group by branch_id order by count(*) desc limit 1;
  end if;
  if b is null then raise exception 'No branch with prep items found (add items under Prep planning → Setup first)'; end if;
  raise notice 'Seeding branch %', (select name from public.branches where id = b);
  for it in select * from public.prep_items where branch_id = b and is_active loop
    start_qty := 0;
    for d in select generate_series((now() at time zone 'Europe/Berlin')::date - 42, (now() at time zone 'Europe/Berlin')::date - 1, interval '1 day')::date loop
      wd := extract(isodow from d)::int;
      prep := greatest(0, it.target_max[wd] - start_qty);
      use_qty := round((it.target_max[wd] * (0.75 + random() * 0.30))::numeric, 1);
      end_qty := greatest(0, round(start_qty + prep - use_qty, 1));
      insert into public.prep_lists (branch_id, plan_date, status, version, sent_at) values (b, d, 'sent', 1, d + time '20:00')
        on conflict (branch_id, plan_date) do nothing;
      select id into list from public.prep_lists where branch_id = b and plan_date = d;
      insert into public.prep_list_lines (list_id, item_id, item_name, unit, container_size, container_label, target, leftover, reserve, to_prepare, sort)
        values (list, it.id, it.name, it.unit, it.container_size, it.container_label, it.target_max[wd], start_qty, it.reserve[wd], prep, it.sort)
        on conflict (list_id, item_id) do nothing;
      insert into public.prep_leftovers (branch_id, count_date, item_id, qty) values (b, d, it.id, end_qty)
        on conflict (branch_id, count_date, item_id) do nothing;
      select qty into start_qty from public.prep_leftovers where branch_id = b and count_date = d and item_id = it.id;
    end loop;
  end loop;
end $$;
select count(*) as sample_lists from public.prep_lists where sent_at::time = '20:00';
