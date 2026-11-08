-- Team checklists by weekday (Stuttgart preparation-team document, Nov 2026).
-- Managers keep standing tasks per team + weekday; the first visit of the day copies the
-- matching templates into that day's `checklists` rows. The unique index makes two people
-- opening the list at the same moment harmless (second insert is ignored).
begin;

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  team text not null check (length(trim(team)) between 1 and 60),
  section text check (section is null or length(trim(section)) between 1 and 60),
  task text not null check (length(trim(task)) between 3 and 300),
  task_de text check (task_de is null or length(trim(task_de)) between 3 and 300),
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  input_kind text not null default 'check' check (input_kind in ('check','number')),
  sort integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists checklist_templates_branch on public.checklist_templates (branch_id, is_active);

alter table public.checklist_templates enable row level security;
drop policy if exists checklist_templates_select on public.checklist_templates;
create policy checklist_templates_select on public.checklist_templates for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()));
drop policy if exists checklist_templates_manage on public.checklist_templates;
create policy checklist_templates_manage on public.checklist_templates for insert to authenticated
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
drop policy if exists checklist_templates_update on public.checklist_templates;
create policy checklist_templates_update on public.checklist_templates for update to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
revoke all on public.checklist_templates from anon;
grant select, insert, update on public.checklist_templates to authenticated;

alter table public.checklists add column if not exists template_id uuid references public.checklist_templates(id) on delete set null;
alter table public.checklists add column if not exists task_de text;
-- NULL template_id (hand-added tasks) never conflicts; one row per template per day.
create unique index if not exists checklists_template_day on public.checklists (branch_id, work_date, template_id);

notify pgrst, 'reload schema';
commit;
