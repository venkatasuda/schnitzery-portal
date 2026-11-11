-- STAGING ONLY: private "documents" bucket like production (employee documents, payslips, sick notes).
-- Employees may upload/read only inside their own folder "<user_id>/…"; managers get files via
-- server-side signed links (service role) after an RLS check on the row. Safe to re-run.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "staging documents own insert" on storage.objects;
create policy "staging documents own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "staging documents own read" on storage.objects;
create policy "staging documents own read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

select id, public from storage.buckets where id = 'documents';
