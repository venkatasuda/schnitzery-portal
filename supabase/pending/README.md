# Pending database fixes

These are **not applied yet**. They live here, outside `supabase/migrations/`, so
that `supabase db push` cannot run them by accident.

See `PRODUCTION-AUDIT.md` items 14–19 for the reasoning behind each one.

| File | Audit items | Risk | Status |
|------|-------------|------|--------|
| `01_safe_fixes.sql` | 14, 16, 19 | None | ✅ **APPLIED & VERIFIED 2026-07-18** |
| `02_attendance_enforcement.sql` | 15, 17 | Changes what offline attendance is accepted | Safe to apply — the table has **0 offline events**, so nothing can be rejected |
| `03_user_pay_step_a.sql` | 18 (step A) | None — only adds a table and copies data | Not yet applied |
| `04_user_pay_step_c_drop.sql` | 18 (step C) | **Drops `users.hourly_wage`** | Not yet applied — read the conditions at the top |
| `20260718_audit_fixes.sql` | superseded | — | Delete: `git rm supabase/pending/20260718_audit_fixes.sql` |

## Item 18 — the three-step sequence

The wage exposure cannot be fixed with a policy change. Postgres RLS is
row-level, so any policy letting a staff member see a colleague's `users` row
exposes every column of it. The column has to physically move.

| Step | What | Where |
|------|------|-------|
| **A** | Create `user_pay`, copy wages in | `03_user_pay_step_a.sql` |
| **B** | Point the app at `user_pay` | Code — already written, in `src/lib/pay/wages.ts` + 4 query files |
| **C** | Drop `users.hourly_wage` | `04_user_pay_step_c_drop.sql` |

**Order matters and cannot be shortcut.** A and B are both harmless on their
own — the hole stays open until C runs. But C before B deployed means wages show
blank on the Labour and Payroll pages until the code catches up.

Correct sequence: apply A → verify the counts → merge and **deploy** B → open
the live Labour page and confirm wages still show → then apply C.

`04` has a pre-flight block that aborts if any wage is missing from `user_pay`,
and takes a 30-day backup table before dropping anything.

## Order

1. Back up: Supabase dashboard → Database → Backups.
2. Apply `01_safe_fixes.sql` — SQL Editor → paste → Run.
3. Run the verification queries at the bottom of that file.
4. Run the counting query at the top of `02_attendance_enforcement.sql`.
5. Read what the result means (it's explained in the file), then decide.
6. If applying `02`, watch the error query at the bottom of it for a week.

`01` and `02` both replace `sync_attendance_events()`. Applying `01` after `02`
rolls the enforcement back off while keeping the timezone fix — that is the
intended rollback path.

## Still not written

**Item 18 — every employee can read colleagues' `hourly_wage`, `phone` and
`email`.** This is the most serious data-protection finding in the system and it
is not fixed by either file here. It needs a new `user_pay` table plus matching
application changes, sequenced so nothing breaks:

1. create + backfill `user_pay`
2. repoint `labor.ts` (and any other reader) at it
3. verify the labour-cost report still matches
4. only then drop `users.hourly_wage`

A sketch is in the commented-out Section 4 of `20260718_audit_fixes.sql`. Do not
run it as-is — dropping the column before step 2 breaks the labour report.

## Once applied

Move the file into `supabase/migrations/` with a timestamp **later** than
`20260718081316_remote_schema.sql`, so the history reflects what actually ran.
