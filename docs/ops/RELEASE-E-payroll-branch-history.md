# Release E runbook — payroll identity after a branch change

Design: `docs/PAYROLL-BRANCH-HISTORY.md`. Built by Claude (Codex unavailable), so
review is not independent: compensated by a blocking isolated-Postgres test that
first reproduces the bug with production's `users_select` RLS, then proves the fix.

## What changes
- Migration `20261021120000_payroll_branch_worker_identities.sql`: new
  `branch_worker_identities` (definer, manager + accessible branch only, ≤62-day
  window, four columns, only people with completed shifts there) and
  `get_payroll_inputs` whose `staff` now comes from it. Same signature/return type.
- `src/lib/queries/live-attendance.ts`: approval queue resolves moved employees'
  names via the same function (falls back to "Unknown" on any error).
- CI runs `scripts/checks/payroll-branch-history.cjs`.

## Evidence (2026-10-21)
`payroll-branch-history.cjs` passes: bug reproduced on the old function; after the
migration the moved employee is named in X's payroll, shifts/wages unchanged,
approval succeeds via the service path with an identical revision; guards reject
other branch, staff role, >62 days, empty window, anon; upper bound exclusive; no
wider `users` access. Existing `wage-history`, `payroll-snapshots`, `payroll-query`,
`payroll-access`, `correction-integrity`, `attendance-review` checks still pass.

## Steps
0. **Rollback capture** (Schnitzery SQL editor, read-only) — save the output locally:
   ```sql
   select pg_get_functiondef('public.get_payroll_inputs(uuid,text)'::regprocedure);
   ```
1. Local: `npm test -- --coverage`, `npx tsc --noEmit`, `npm run build`.
2. Branch from `develop` → commit → push → PR into `develop` → CI green. **Don't merge.**
3. Apply the migration in the Schnitzery SQL editor (it is one transaction), then:
   ```sql
   insert into supabase_migrations.schema_migrations(version, name)
   values ('20261021120000','payroll_branch_worker_identities') on conflict do nothing;
   select proname from pg_proc where proname = 'branch_worker_identities';  -- 1 row
   ```
4. Merge PR → `develop`, then PR `develop` → `main`, CI green, merge.
5. Smoke (manager, no writes): Payroll page loads for the current and previous month
   with the same employees and totals as before; an already-approved month still
   shows its frozen snapshot; Attendance → Approval tab loads.

Order note: migration-first is safe — the old app does not call the new function and
`get_payroll_inputs` keeps its signature. For employees who never moved, payroll
output is identical; drafts change only where a moved employee was missing.

## Rollback
- App: Vercel → promote previous deployment (migration can stay).
- Migration: run the Step 0 capture (restores old `get_payroll_inputs`), then
  `drop function public.branch_worker_identities(uuid,date,date);`
