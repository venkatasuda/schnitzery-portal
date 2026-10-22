# Release C — Stock reconciliation: release runbook

Design: [STOCK-RECONCILIATION.md](../STOCK-RECONCILIATION.md) (approved 2026-10-21).

## What ships
| Part | File |
|---|---|
| Interval maths (pure, unit-tested) | `src/lib/inventory/reconciliation.ts` · `reconciliation.test.ts` |
| Query + review action (caller's RLS) | `src/lib/queries/reconciliation.ts` |
| Inventory → **Reconciliation** tab (EN/DE) | `src/app/(app)/inventory/Reconciliation.tsx`, `page.tsx`, `messages.ts`, `globals.css` |
| Review table (insert-only) | `supabase/migrations/20261021180000_stock_reconciliation_reviews.sql` |
| Checks (CI) | `stock-reconciliation.cjs` (isolated Postgres), `stock-reconciliation-query.cjs`, vitest |

Existing forecasts/analytics are unchanged (`countDepletion` untouched).

## Order: migration first
The new tab reads `stock_reconciliation_reviews`; without the table the tab shows
"could not be loaded". The migration only **adds** a table, so applying it before
the code is safe and nothing else changes.

## Steps
1. **CI green** on the feature PR → merge to `develop`.
2. **Migration** — Supabase dashboard, project `vxwtmtlkwvwcdegtcjuz` (check the
   name is Schnitzery, not FarmersFresh) → SQL Editor → paste the migration → Run.
   Verify:
   ```sql
   select count(*) from public.stock_reconciliation_reviews;          -- 0
   select polname from pg_policy where polrelid='public.stock_reconciliation_reviews'::regclass; -- 2 rows
   ```
3. **Staging browser pass** (local stack, manager account):
   - Inventory → Reconciliation shows count pairs; "Needs review" lists only Gain/Unusual.
   - Mark one reviewed with a note → it leaves "Needs review", note visible under "All".
   - Enter a missing delivery for that period → row returns with "figures changed".
   - German UI: all labels German. Staff account: "Managers only."
4. **Release** `develop` → `main` PR, exact-head CI green, merge. Confirm the
   Vercel production deploy is this commit (promote if an older build finished last).
5. **Smoke test** in production as a manager: open the tab, switch 30/90/180 days.
   Do **not** create test reviews on real data — reviews are permanent evidence.

## Rollback
- Code: Vercel → promote the previous production deployment. The table can stay.
- Table (only if never used): `select count(*) from public.stock_reconciliation_reviews;`
  must be 0, then
  ```sql
  begin;
  drop table public.stock_reconciliation_reviews;
  drop function private.stock_reviews_immutable();
  commit;
  ```
  If reviews exist, export them first; they are manager evidence.

## Known limits (by design)
- "Used or lost" cannot be split: there are no item-level sales.
- Transfers changed before 2026-10-15 (journal start) have no exact time → intervals
  touching them are **Uncertain**.
- Unusual = more than 2× the median daily use of ≥ 3 earlier clean intervals of the
  same product; new products are never flagged unusual.
- Managers and branch owners see their own branch. Brand owners / super admins get a
  **Branch** picker on the tab; the server only accepts a branch the caller can read
  (RLS), and review inserts are still checked by the database policy.
