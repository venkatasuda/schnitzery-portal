-- Standing weekly availability ("never Mondays"): one pattern per employee that applies to every week
-- without its own availability entry. days has the same shape as availability.days:
-- { "Monday": ["Morning","Evening"], … } — a missing/empty day = not available.
begin;
create table if not exists public.availability_defaults (
  user_id uuid primary key references public.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  days jsonb not null check (jsonb_typeof(days) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.availability_defaults enable row level security;
-- Your own, or a manager of that branch (same rule as availability).
drop policy if exists availability_defaults_rw on public.availability_defaults;
create policy availability_defaults_rw on public.availability_defaults for all to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and (user_id = auth.uid() or public.is_manager()))
  with check (branch_id in (select public.accessible_branch_ids()) and (user_id = auth.uid() or public.is_manager()));
revoke all on public.availability_defaults from anon;
grant select, insert, update, delete on public.availability_defaults to authenticated;
notify pgrst, 'reload schema';
commit;
