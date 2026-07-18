***REMOVED*** Pending database fixes

These are **not applied yet**. They live here, outside `supabase/migrations/`, so
that `supabase db push` cannot run them by accident.

See `PRODUCTION-AUDIT.md` items 14–19 for the reasoning behind each one.

| File | Audit items | Risk | Apply? |
|------|-------------|------|--------|
| `01_safe_fixes.sql` | 14, 16, 19 | None — nothing that worked stops working | Yes, after a backup |
| `02_attendance_enforcement.sql` | 15, 17 | Changes what offline attendance is accepted | Only after running the counting query inside it |
| `20260718_audit_fixes.sql` | superseded | — | Delete — replaced by the two files above |

***REMOVED******REMOVED*** Order

1. Back up: Supabase dashboard → Database → Backups.
2. Apply `01_safe_fixes.sql` — SQL Editor → paste → Run.
3. Run the verification queries at the bottom of that file.
4. Run the counting query at the top of `02_attendance_enforcement.sql`.
5. Read what the result means (it's explained in the file), then decide.
6. If applying `02`, watch the error query at the bottom of it for a week.

`01` and `02` both replace `sync_attendance_events()`. Applying `01` after `02`
rolls the enforcement back off while keeping the timezone fix — that is the
intended rollback path.

***REMOVED******REMOVED*** Still not written

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

***REMOVED******REMOVED*** Once applied

Move the file into `supabase/migrations/` with a timestamp **later** than
`20260718081316_remote_schema.sql`, so the history reflects what actually ran.
