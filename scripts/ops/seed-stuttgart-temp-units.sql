-- Stuttgart fridges/freezers by room. Chicken 0–4 °C, other fridges 0–7 °C, freezer −25…−18 °C.
-- Run AFTER migration 20261109150000_temp_rooms.sql. Safe to re-run (same active name is skipped).
-- Staging: run  set seed.branch = 'LOCAL TEST Branch A';  first.
do $$
declare b uuid; target text := coalesce(nullif(current_setting('seed.branch', true), ''), 'Schnitzery Stuttgart');
begin
  select id into b from public.branches where name = target and is_active;
  if b is null then raise exception 'Branch "%" not found — check the name in Settings / Branches', target; end if;
  insert into public.temp_units (branch_id, room, name, kind, min_temp, max_temp, sort, is_active)
  select b, v.room, v.name, v.kind, v.lo, v.hi, v.sort, true from (values
    ('Preparation', 'Prepared chicken', 'fridge', 0::numeric, 4::numeric, 10),
    ('Preparation', 'Salad fridge', 'fridge', 0, 7, 20),
    ('Preparation', 'Bread freezer', 'freezer', -25, -18, 30),
    ('Preparation', 'Cheese freezer', 'freezer', -25, -18, 40),
    ('Kitchen', 'Main topping station', 'fridge', 0, 7, 110),
    ('Kitchen', 'Burger station', 'fridge', 0, 7, 120),
    ('Kitchen', 'Sauce fridge', 'fridge', 0, 7, 130),
    ('Kitchen', 'Stock fridge', 'fridge', 0, 7, 140),
    ('Kitchen', 'Chicken fridge', 'fridge', 0, 4, 150),
    ('Storage', 'Raw ingredients fridge', 'fridge', 0, 7, 210),
    ('Storage', 'Fries freezer', 'freezer', -25, -18, 220)
  ) as v(room, name, kind, lo, hi, sort)
  where not exists (select 1 from public.temp_units u where u.branch_id = b and u.name = v.name and u.is_active);
end $$;
select room, name, kind, min_temp, max_temp from public.temp_units where is_active order by sort, name;
