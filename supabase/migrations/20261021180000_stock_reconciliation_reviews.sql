-- Release C: a manager's note on one reconciliation interval (count A → count B).
-- Insert-only evidence: reviewing never edits stock records. `figures` is the
-- snapshot the reviewer saw; the same interval can be reviewed again only if its
-- figures have since changed (e.g. a missing delivery was entered).
begin;
set local lock_timeout='3s';
create table public.stock_reconciliation_reviews (
  id bigint generated always as identity primary key,
  branch_id uuid not null references public.branches(id),
  from_count_id uuid not null,
  to_count_id uuid not null,
  figures jsonb not null check (jsonb_typeof(figures)='object'),
  note text not null check (length(btrim(note)) between 3 and 500),
  reviewed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_count_id <> to_count_id),
  unique (from_count_id, to_count_id, figures)
);
alter table public.stock_reconciliation_reviews enable row level security;
revoke all on public.stock_reconciliation_reviews from public,anon,authenticated,service_role;
grant select on public.stock_reconciliation_reviews to authenticated,service_role;
grant insert(branch_id,from_count_id,to_count_id,figures,note) on public.stock_reconciliation_reviews to authenticated;
create policy stock_reviews_read on public.stock_reconciliation_reviews for select to authenticated
  using ((select public.is_manager()) and branch_id in (select public.accessible_branch_ids()));
create policy stock_reviews_record on public.stock_reconciliation_reviews for insert to authenticated
  with check ((select public.is_manager()) and reviewed_by=(select auth.uid())
    and branch_id in (select public.accessible_branch_ids())
    and exists(select 1 from public.inventory_counts c where c.id=from_count_id and c.branch_id=stock_reconciliation_reviews.branch_id)
    and exists(select 1 from public.inventory_counts c where c.id=to_count_id and c.branch_id=stock_reconciliation_reviews.branch_id));

create schema if not exists private;
create function private.stock_reviews_immutable() returns trigger
language plpgsql set search_path='' as $$begin raise exception 'Reconciliation reviews are immutable'; end $$;
revoke all on function private.stock_reviews_immutable() from public,anon,authenticated,service_role;
create trigger stock_reviews_immutable before update or delete or truncate on public.stock_reconciliation_reviews
  for each statement execute function private.stock_reviews_immutable();
commit;
