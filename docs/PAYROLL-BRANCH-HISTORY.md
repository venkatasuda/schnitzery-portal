# Release E — Historical branch assignments in payroll (design note)

Status: design approved by lead 2026-10-21 · Builder: Codex · Reviewer: Claude.
Scope is deliberately small. Read with `docs/PAYROLL-APPROVALS.md`.

## Problem (verified in source, not assumed)

`get_payroll_inputs(p_branch, p_month)` assembles three inputs:

| Input | Selected by | Correct after an employee changes branch? |
|---|---|---|
| shifts (`logs`) | `attendance_logs.branch_id = p_branch` (the shift's own branch) | ✅ |
| wages | `wage_history` rows with `branch_id = p_branch`, effective on each work date; RLS `wage_history_read` is scoped by the **row's** branch | ✅ |
| staff identity | `users.branch_id = p_branch` (**current** branch) — and `users_select` RLS only shows users whose **current** branch is accessible | ❌ |

Consequence when someone works at branch X in month M and is later moved to Y:
- X's payroll for M still has their shifts and X-rate wages, but no identity row →
  shown as **"Unassigned employee"** and counted in `missingWages` →
  **X can never approve month M** (`readiness.canApprove` stays false).
- X's attendance approval queue (`getAttendanceApprovals`) shows the name **"Unknown"**
  (the shift itself is still approvable — decisions key on the shift's branch).
- Approved snapshots are unaffected (frozen).

There is no in-app transfer workflow today; branch changes are manual DB edits. The
gap is real whenever that happens (and for HQ re-assignments).

## Decision

**The shift is the source of truth for "who worked here".** Expose a *minimal,
bounded* identity read for people who actually worked at a branch the caller manages.

Not doing (YAGNI): a branch-membership history table. Nothing else needs "who
belonged where" independent of shifts. Add one later only if HR needs a transfer
audit trail, cross-branch rostering, or contract history.

## Changes

1. **New function** `public.branch_worker_identities(p_branch uuid, p_from date, p_to date)`
   `returns table(id uuid, full_name text, employee_code text, team text)`
   - `security definer`, `set search_path = ''`, schema-qualified everything.
   - Guard: caller is a manager (`public.is_manager()`) **and** `p_branch` is in
     `public.accessible_branch_ids()`; `p_from < p_to`; window ≤ 62 days. Else raise.
   - Returns only users with `attendance_logs.status='complete'` at `p_branch` and
     `work_date` in `[p_from, p_to)`. Only those four columns — never email, phone,
     role, wages, documents.
   - `revoke all … from public, anon; grant execute … to authenticated`.
2. **`get_payroll_inputs`** — replace the `'staff'` subquery with
   `select … from public.branch_worker_identities(p_branch, first_day, (first_day + interval '1 month')::date)`.
   Everything else unchanged. (`revision` md5 changes only for affected branches —
   intended: the draft really changed.)
3. **`getAttendanceApprovals`** (`src/lib/queries/live-attendance.ts`) — resolve names via
   the same RPC for the pending shifts' date range instead of a direct `users` read;
   keep `"Unknown"` only as a last-resort fallback.
4. **`payroll.ts`** — no logic change needed: moved workers now appear in `staff`, so
   identity no longer triggers `missingWages`. Keep the "Unassigned employee" fallback:
   it still (correctly) blocks approval for genuinely deleted users.
5. Documented limitation: `team` shown is the employee's **current** team.

## Security review points (for Claude's review)
- Definer function must not widen access: branch must be accessible to the caller;
  rows limited to people with shifts there in the window; four columns only.
- Uses `(select auth.uid())` via the existing helpers; no caller-supplied user IDs.
- Staff/kiosk roles must be denied. A manager of X must get nothing for branch Y.

## Tests (blocking, isolated PostgreSQL — extend `scripts/checks/payroll-query.cjs` / `payroll-access.cjs`)
- Employee works at X in M, then `users.branch_id := Y`: X manager's payroll for M lists
  them by name; `missingWages` not raised by identity; approval allowed when shifts are
  approved and X wages confirmed.
- X manager calling for branch Y → error. Staff role → error. Window > 62 days → error.
- User with no shifts at X in the window → not returned. Period bounds exclusive at `p_to`.
- Previously approved snapshot for M unchanged after the move.
- Approval queue shows the moved employee's real name.

## Migration & rollout
- Additive: new function + `create or replace` of `get_payroll_inputs` (same signature
  and return type). Backward-compatible with the current app.
- Before applying: capture `pg_get_functiondef('public.get_payroll_inputs(uuid,text)'::regprocedure)`
  for rollback (same practice as Release A). Rollback = restore it + drop the new function.
- Order: isolated checks → local staging (move a synthetic employee between the two
  test branches, verify payroll + approval names) → apply migration → app release.
- No wage dates are invented; unconfirmed rates still block approval as today.

## Out of scope
In-app transfer UI · membership-history table · future-dated rate scheduling ·
re-attributing historical shifts · team history.
