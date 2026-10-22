# Release D — Reliable analytics: release runbook

Design: [ANALYTICS-RELIABILITY.md](../ANALYTICS-RELIABILITY.md) (approved 2026-10-21).
**Ship after Release C** — usage values come from the reconciliation query and its
review table (`20261021180000`). No new migration.

## What changes for managers
| Screen | Before | After |
|---|---|---|
| Analytics · Business overview · Home | Labour € left out staff without wage; deliveries without cost = €0; % divided by sales even with days missing | Incomplete totals show `≥ €…` + the reason; % shown only when sales exist for every open day, wages and costs complete |
| Analytics · team / staff cost, Overview branch table | Missing wage = €0 | Staff cost "—"; team and branch totals `≥ €…` |
| Inventory → Reports | One problem product blanked usage and stock value for **all** products | Usage per product from Reconciliation (OK/Unusual intervals), priced at the **latest delivery price on or before the count**; withheld products make the total `≥`; stock value uses latest price |
| Inventory → Reports chips | "Purchase spend / sales" only | plus **Cost of goods used / sales**, shown only when all products were counted on the same days, every interval is clean and priced, and sales are complete for that span |

"Open day" = a day on which anyone at the branch completed a shift. A closed day
without sales is not missing.

Also aligned: **Monthly summary** (labour/food % only when complete, `≥` subtotals,
missing reasons listed, employees without wage = blank in CSV) and **Simulator**
(refuses to simulate on an incomplete month instead of producing precise-looking numbers).

## Files
`src/lib/analytics/coverage.ts` (+ test) · `src/lib/inventory/valuation.ts` (+ test) ·
`src/lib/inventory/reconciliation.ts` (last recount of a day wins) ·
`src/lib/queries/{branch-analytics,labor,inventory,reconciliation}.ts` ·
`src/components/BusinessOverview.tsx` · `src/app/(app)/{page,analytics/page,overview/page,inventory/page}.tsx` ·
`messages.ts` · checks `business`, `business-ui`, `inventory-data`, `workspace-ux` extended.

## Steps
1. Release C live (migration applied).
2. Feature PR → `develop`, CI green.
3. Staging browser pass (manager, EN + DE):
   - Analytics with one employee without wage → labour shows `≥ €…`, labour % "—".
   - Delete one day's sales on a day with shifts → sales `≥`, ratios "—", note "Open days without sales: 1".
   - Delivery saved without cost (if any legacy row) → purchases `≥`, "Deliveries without a cost: 1".
   - Inventory → Reports: usage and stock value appear for clean products even when another product has a gain.
4. `develop` → `main`, exact-head CI, confirm the Vercel production build is this commit.

## Rollback
Code only: promote the previous Vercel production deployment. No data changes.

## Known limits
- Cost of goods used % needs all counted products on the same count days; partial
  inventories show the euro usage (`≥`) but no ratio.
- The first interval after the window start is not counted (needs a count inside the window).
- Purchase spend is still not consumption — the label says so.
