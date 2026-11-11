-- Time-off type (vacation / sick / unpaid / special) on the existing leave_requests table.
-- Existing requests become 'vacation' (that is what they were counted as). Only vacation reduces the
-- holiday balance. A sick note is stored as a private storage path in the existing sick_note_url column.
begin;
alter table public.leave_requests add column if not exists leave_type text not null default 'vacation';
alter table public.leave_requests drop constraint if exists leave_type_valid;
alter table public.leave_requests add constraint leave_type_valid check (leave_type in ('vacation', 'sick', 'unpaid', 'special'));
-- A sick note may only point into the requester's own private folder.
alter table public.leave_requests drop constraint if exists leave_sick_note_own_folder;
alter table public.leave_requests add constraint leave_sick_note_own_folder check (sick_note_url is null or sick_note_url like user_id::text || '/%') not valid;
-- Attach (or replace) the sick note later: only the employee, only their own sick-leave request,
-- only a file in their own folder. Nothing else on the request can change this way.
create or replace function private.attach_sick_note(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_path is null or p_path not like auth.uid()::text || '/%' or p_path like '%..%' or length(p_path) > 300 then
    raise exception 'Upload the sick note again.' using errcode = '22023'; end if;
  update public.leave_requests set sick_note_url = p_path
    where id = p_id and user_id = auth.uid() and leave_type = 'sick';
  if not found then raise exception 'Not found or no access.' using errcode = '42501'; end if;
end $$;
revoke all on function private.attach_sick_note(uuid, text) from public, anon;
grant execute on function private.attach_sick_note(uuid, text) to authenticated;
create or replace function public.attach_sick_note(p_id uuid, p_path text) returns void
language sql security invoker set search_path = '' as $$ select private.attach_sick_note(p_id, p_path) $$;
revoke all on function public.attach_sick_note(uuid, text) from public, anon;
grant execute on function public.attach_sick_note(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
