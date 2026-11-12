-- Rate limit for reading delivery notes with AI (cost control): managers and shift leaders, 40 reads per
-- person per day (Europe/Berlin). Counted in the database so it holds across devices and server instances.
begin;
create table if not exists public.note_read_limits (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  primary key (user_id, day)
);
alter table public.note_read_limits enable row level security; -- no policies: only the function below touches it
revoke all on public.note_read_limits from anon, authenticated;

create or replace function public.allow_note_read() returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer; d date := (now() at time zone 'Europe/Berlin')::date;
begin
  if auth.uid() is null or not exists (select 1 from public.users u where u.id = auth.uid() and u.status = 'active'
    and (u.role in ('manager', 'branch_owner', 'brand_owner', 'super_admin')
         or exists (select 1 from public.shift_leaders s where s.user_id = u.id))) then return false; end if;
  insert into public.note_read_limits as l (user_id, day, requests) values (auth.uid(), d, 1)
  on conflict (user_id, day) do update set requests = l.requests + 1
  returning requests into n;
  delete from public.note_read_limits where day < d - 30; -- keep the table small
  return n <= 40;
end $$;
revoke all on function public.allow_note_read() from public, anon;
grant execute on function public.allow_note_read() to authenticated;
notify pgrst, 'reload schema';
commit;
