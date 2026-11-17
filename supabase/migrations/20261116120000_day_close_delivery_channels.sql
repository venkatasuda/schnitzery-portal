-- Day close: delivery platform sales next to the till (Lieferando, Uber Eats, Wolt are not typed into the till;
-- they print on their own order printers). The day's total in daily_sales = till total + platform totals,
-- so every dashboard (labour %, prime cost, forecast, sales per labour hour) sees all sales.
-- channels: {"lieferando": {"gross": 412.50, "orders": 23}, "uber_eats": {...}, "wolt": {...}}; empty = none entered.
-- Additive: one nullable-safe column, close_day gains an optional last parameter. Run once before merging; safe to run twice.
begin;

alter table public.day_closes add column if not exists channels jsonb not null default '{}'::jsonb;
alter table public.day_closes drop constraint if exists day_closes_channels_object;
alter table public.day_closes add constraint day_closes_channels_object check (jsonb_typeof(channels) = 'object');

-- Validates the platform figures; returns the platform total (0 when none).
create or replace function private.delivery_channel_total(p_channels jsonb) returns numeric
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; total numeric := 0; g numeric; o numeric;
begin
  if p_channels is null or jsonb_typeof(p_channels) <> 'object' then raise exception 'Invalid delivery channels' using errcode = '22023'; end if;
  for k, v in select key, value from jsonb_each(p_channels) loop
    if k not in ('lieferando', 'uber_eats', 'wolt') or jsonb_typeof(v) <> 'object'
       or jsonb_typeof(v->'gross') <> 'number' or jsonb_typeof(v->'orders') <> 'number'
       or exists (select 1 from jsonb_object_keys(v) x where x not in ('gross', 'orders'))
      then raise exception 'Invalid delivery channels' using errcode = '22023'; end if;
    g := (v->>'gross')::numeric; o := (v->>'orders')::numeric;
    if g < 0 or g >= 1e6 or g <> round(g, 2) or o < 0 or o >= 10000 or o <> trunc(o)
      then raise exception 'Invalid delivery channels' using errcode = '22023'; end if;
    total := total + g;
  end loop;
  return total;
end $$;

drop function if exists public.close_day(uuid, date, numeric, numeric, numeric, jsonb, text);
drop function if exists private.close_day(uuid, date, numeric, numeric, numeric, jsonb, text);

-- Same rules as 20261109090000_day_closes.sql; the sales figure is now till + delivery platforms.
create or replace function private.close_day(p_branch uuid, p_date date, p_pos_total numeric, p_pos_cash numeric, p_counted_cash numeric, p_reasons jsonb, p_note text, p_channels jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare snap jsonb; diff numeric; open_points text[] := '{}'; k text; new_id uuid; recorded numeric; delivery numeric; total numeric;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Day close access required' using errcode = '42501'; end if;
  if p_date is null or p_date > (now() at time zone 'Europe/Berlin')::date or p_date < (now() at time zone 'Europe/Berlin')::date - 2 then raise exception 'Invalid close date'; end if;
  if p_pos_cash is not null and p_pos_total is not null and p_pos_cash > p_pos_total then raise exception 'POS cash cannot exceed POS total'; end if;
  if p_reasons is null or jsonb_typeof(p_reasons) <> 'object' then raise exception 'Invalid reasons'; end if;
  delivery := private.delivery_channel_total(coalesce(p_channels, '{}'::jsonb));
  total := case when p_pos_total is not null then round(p_pos_total + delivery, 2) end;
  perform pg_advisory_xact_lock(hashtextextended('day-close:' || p_branch::text || ':' || p_date::text, 0));
  if exists (select 1 from public.day_closes where branch_id = p_branch and work_date = p_date) then raise exception 'Day already closed' using errcode = '23505'; end if;

  -- daily_sales stays the single sales source: fill a missing day with till + delivery, never overwrite.
  if total is not null then
    insert into public.daily_sales (branch_id, sale_date, amount) values (p_branch, p_date, total)
    on conflict (branch_id, sale_date) do nothing;
  end if;
  select amount into recorded from public.daily_sales where branch_id = p_branch and sale_date = p_date for update;
  snap := private.day_close_snapshot(p_branch, p_date) || jsonb_build_object('recorded_sales', recorded);
  diff := case when p_counted_cash is not null and p_pos_cash is not null then round(p_counted_cash - p_pos_cash, 2) end;
  if total is null or (recorded is not null and abs(total - recorded) >= 0.01) then
    open_points := array_append(open_points, 'sales'); end if;
  if (snap->'temps'->>'logged')::int < (snap->'temps'->>'units')::int then open_points := array_append(open_points, 'temps'); end if;
  if (snap->'checklists'->>'done')::int < (snap->'checklists'->>'total')::int then open_points := array_append(open_points, 'checklists'); end if;
  if (snap->'leftovers'->>'counted')::int < (snap->'leftovers'->>'items')::int then open_points := array_append(open_points, 'leftovers'); end if;
  if (snap->'leftovers'->>'items')::int > 0 and (snap->>'next_prep_list') is distinct from 'sent' then open_points := array_append(open_points, 'prep_list'); end if;
  if jsonb_array_length(snap->'clocked_in') > 0 then open_points := array_append(open_points, 'clocked_in'); end if;
  if p_counted_cash is null or p_pos_cash is null or diff <> 0 then open_points := array_append(open_points, 'cash'); end if;
  foreach k in array open_points loop
    if length(trim(coalesce(p_reasons->>k, ''))) < 3 then raise exception 'Reason required for %', k using errcode = '22023'; end if;
  end loop;

  insert into public.day_closes (branch_id, work_date, pos_total, pos_cash, counted_cash, cash_difference, snapshot, reasons, note, closed_by, channels)
  values (p_branch, p_date, p_pos_total, p_pos_cash, p_counted_cash, diff, snap || jsonb_build_object('open_points', to_jsonb(open_points)),
    (select coalesce(jsonb_object_agg(key, left(trim(value), 300)), '{}'::jsonb) from jsonb_each_text(p_reasons) where key = any(open_points)),
    nullif(trim(p_note), ''), auth.uid(), coalesce(p_channels, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.close_day(p_branch uuid, p_date date, p_pos_total numeric, p_pos_cash numeric, p_counted_cash numeric, p_reasons jsonb, p_note text default null, p_channels jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select private.close_day(p_branch, p_date, p_pos_total, p_pos_cash, p_counted_cash, p_reasons, p_note, p_channels) $$;

revoke all on function private.delivery_channel_total(jsonb) from public, anon, authenticated;
revoke all on function private.close_day(uuid, date, numeric, numeric, numeric, jsonb, text, jsonb), public.close_day(uuid, date, numeric, numeric, numeric, jsonb, text, jsonb) from public, anon;
grant execute on function private.close_day(uuid, date, numeric, numeric, numeric, jsonb, text, jsonb), public.close_day(uuid, date, numeric, numeric, numeric, jsonb, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
