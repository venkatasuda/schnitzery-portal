-- Stuttgart prep items with weekday targets from "Stuttgart Schnitzery Preparation team Analysis", page 7.
-- Arrays are Mon, Tue, Wed, Thu, Fri, Sat, Sun. The list uses "target up to"; reserve is shown separately.
-- Run AFTER migration 20261108120000_prep_lists.sql. Safe to re-run (same active name is skipped).
begin;
do $$
declare b uuid; target text := coalesce(nullif(current_setting('seed.branch', true), ''), 'Schnitzery Stuttgart');
begin
  -- Stuttgart by default; for staging run  set seed.branch = 'LOCAL TEST Branch A';  first.
  select id into b from public.branches where name = target and is_active;
  if b is null then raise exception 'Branch "%" not found — check the name in Settings / Branches', target; end if;
  insert into public.prep_items (branch_id, name, name_de, unit, container_size, container_label, target_min, target_max, reserve, sort)
  select b, v.name, v.name_de, v.unit, v.size, v.label, v.tmin::numeric[], v.tmax::numeric[], v.res::numeric[], v.sort
  from (values
    ('Chicken', 'Hähnchen', 'kg', 20::numeric, 'containers', '{100,100,100,100,140,180,140}', '{120,120,120,120,160,220,150}', '{40,40,40,40,40,40,40}', 10),
    ('Kraut salad', 'Krautsalat', 'kg', 15, 'containers', '{30,30,30,30,45,60,45}', '{40,40,40,40,45,60,45}', '{15,15,15,15,15,15,15}', 20),
    ('Rotkohl salad', 'Rotkohlsalat', 'kg', 15, 'containers', '{30,30,30,30,45,45,30}', '{30,30,30,30,45,45,45}', '{15,15,15,15,15,15,15}', 30),
    ('Cheese sauce', 'Käsesoße', 'containers', null, null, '{4,4,4,4,6,8,6}', '{5,5,5,5,7,8,7}', '{0,0,0,0,0,0,0}', 40),
    ('Cheddar cheese', 'Cheddar', 'blocks (4 kg)', null, null, '{6,6,6,6,7,8,7}', '{6,6,6,6,7,8,7}', '{0,0,0,0,0,0,0}', 50),
    ('Parmesan', 'Parmesan', 'containers (2 kg)', null, null, '{2,2,2,2,2,2,2}', '{2,2,2,2,2,2,2}', '{0,0,0,0,0,0,0}', 60),
    ('Mango curry', 'Mango-Curry', 'batches', null, null, '{2,2,2,2,2,2,2}', '{2,2,2,2,2,2,2}', '{0,0,0,0,0,0,0}', 70)
  ) as v(name, name_de, unit, size, label, tmin, tmax, res, sort)
  where not exists (select 1 from public.prep_items i where i.branch_id = b and i.name = v.name and i.is_active);
end $$;
commit;
