-- Stuttgart shift times (Settings → Shift times). Run AFTER migration 20261111090000_shift_times_weekdays.sql.
-- Sun–Thu / Fri–Sat:  Preparation 08:00–13:00 · Morning 10:30–17:30 / 10:30–18:30 · Mid: time pending ·
-- Evening ("Night" key; Manager "Evening") 17:30–23:30 / 17:30–02:00. Breaks already set are kept.
-- Staging: run  set seed.branch = 'LOCAL TEST Branch A';  first. Safe to re-run.
do $$
declare b uuid; v record; target text := coalesce(nullif(current_setting('seed.branch', true), ''), 'Schnitzery Stuttgart');
begin
  select id into b from public.branches where name = target and is_active;
  if b is null then raise exception 'Branch "%" not found — check the name in Settings / Branches', target; end if;
  for v in select * from (values
    ('Preparation', 'Morning', '08:00'::time, '13:00'::time, null::time, null::time),
    ('Kitchen', 'Morning', '10:30', '17:30', '10:30', '18:30'),
    ('Kitchen', 'Mid', null, null, null, null),
    ('Kitchen', 'Night', '17:30', '23:30', '17:30', '02:00'),
    ('Cashier', 'Morning', '10:30', '17:30', '10:30', '18:30'),
    ('Cashier', 'Mid', null, null, null, null),
    ('Cashier', 'Night', '17:30', '23:30', '17:30', '02:00'),
    ('Dishwashing', 'Morning', '10:30', '17:30', '10:30', '18:30'),
    ('Dishwashing', 'Mid', null, null, null, null),
    ('Dishwashing', 'Night', '17:30', '23:30', '17:30', '02:00'),
    ('Manager', 'Morning', '10:30', '17:30', '10:30', '18:30'),
    ('Manager', 'Evening', '17:30', '23:30', '17:30', '02:00')
  ) as t(team, shift, s, e, fs, fe) loop
    update public.shift_times set start_time = v.s, end_time = v.e, fri_sat_start = v.fs, fri_sat_end = v.fe, is_active = true, updated_at = now()
      where branch_id = b and team = v.team and shift = v.shift;
    if not found then
      insert into public.shift_times (branch_id, team, shift, start_time, end_time, fri_sat_start, fri_sat_end, break_mins, is_active)
      values (b, v.team, v.shift, v.s, v.e, v.fs, v.fe, 0, true);
    end if;
  end loop;
end $$;
select team, shift, start_time, end_time, fri_sat_start, fri_sat_end, break_mins from public.shift_times
  where branch_id = (select id from public.branches where name = coalesce(nullif(current_setting('seed.branch', true), ''), 'Schnitzery Stuttgart')) order by team, shift;
