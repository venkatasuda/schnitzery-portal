-- Prep items: no container line for Chicken / Kraut salad / Rotkohl salad; Cheddar and Parmesan counted in kg.
-- Converts targets AND already recorded leftovers / list lines (blocks × 4 kg, containers × 2 kg) so history stays consistent.
-- All branches. Safe to re-run: items already in kg are not converted again.
begin;
update public.prep_items set container_size = null, container_label = null
  where name in ('Chicken', 'Kraut salad', 'Rotkohl salad');

do $$
declare r record;
begin
  for r in select i.id, f.factor from public.prep_items i
    join (values ('Cheddar cheese', 'blocks (4 kg)', 4::numeric), ('Parmesan', 'containers (2 kg)', 2::numeric)) as f(name, old_unit, factor)
      on i.name = f.name and i.unit = f.old_unit
  loop
    update public.prep_items set unit = 'kg',
      target_min = (select array_agg(v * r.factor order by n) from unnest(target_min) with ordinality as t(v, n)),
      target_max = (select array_agg(v * r.factor order by n) from unnest(target_max) with ordinality as t(v, n)),
      reserve    = (select array_agg(v * r.factor order by n) from unnest(reserve) with ordinality as t(v, n))
      where id = r.id;
    update public.prep_leftovers set qty = qty * r.factor where item_id = r.id;
    update public.prep_list_lines set unit = 'kg', target = target * r.factor, leftover = leftover * r.factor,
      reserve = reserve * r.factor, override = override * r.factor, to_prepare = to_prepare * r.factor
      where item_id = r.id;
  end loop;
end $$;

select name, unit, container_size, target_max from public.prep_items where is_active order by sort;
commit;
