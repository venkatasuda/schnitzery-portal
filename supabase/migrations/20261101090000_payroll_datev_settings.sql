-- DATEV LODAS export settings per branch (Beraternummer, Mandantennummer, Lohnarten).
-- Lives on payroll_settings, so the existing manager-only RLS on that table applies.
-- Shape is validated in the app (src/lib/pay/datev.ts); the check only keeps it small.
begin;
set local lock_timeout = '3s';
alter table public.payroll_settings add column if not exists datev jsonb not null default '{}'::jsonb;
alter table public.payroll_settings drop constraint if exists payroll_settings_datev_shape;
alter table public.payroll_settings add constraint payroll_settings_datev_shape
  check (jsonb_typeof(datev) = 'object' and pg_column_size(datev) < 2048);
commit;
