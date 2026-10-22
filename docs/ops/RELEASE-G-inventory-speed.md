# Release G — faster inventory reports

## Problem (measured from the code path)
`Inventory → Costs & usage` read the branch's **whole** count and delivery history on every
open, 1,000 rows per request, one request after another. A branch with ~80 products counted
daily and ~3 deliveries a week builds up ≈ 29,000 counts + 12,000 deliveries a year → ~41
sequential requests (≈ 3–5 s at 80–120 ms each from Vercel to Supabase), growing every year.

## Fix
Migration `20261022150000_inventory_report_summaries.sql`:
- `inventory_latest_counts(branch)` — latest count per product (for stock value).
- `inventory_price_baseline(branch, before)` — the last priced delivery day per product before
  the report window (for prices).
- index `inventory_counts(branch_id, count_date)`.

The report now reads only the window plus these summaries: a 30-day report is ~3 requests
whatever the history length. Both functions run with the caller's permissions (RLS unchanged).
`scripts/checks/inventory-summaries.cjs` proves on random history that prices and latest counts
are identical to the full-history answer and that other branches stay invisible.

## Deploy
1. Merge (Vercel deploys). Until the migration is applied the code falls back to the old
   full-history read, so order does not matter.
2. Apply the migration in Supabase `vxwtmtlkwvwcdegtcjuz` (SQL editor or `supabase db push`).
3. Check: open Inventory → Costs & usage; figures unchanged, page loads faster.
Rollback: `drop function public.inventory_latest_counts(uuid); drop function public.inventory_price_baseline(uuid, date);`
— the app falls back automatically.
