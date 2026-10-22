# Codex review handoff — Releases C + D (and leftovers)

Written by Claude (lead) 2026-10-22. Please review independently and **run** the code,
not only read it.

## What to review
| | |
|---|---|
| Commit | `4bf1117` "feat: stock reconciliation (Release C) and reliable analytics (Release D)" |
| Diff | `git diff 104ec46 4bf1117` (single commit) |
| State | Merged: `develop` = `37282e3`, `main` = `f5cafff` — same tree `351cdb2` |
| Designs | `docs/STOCK-RECONCILIATION.md`, `docs/ANALYTICS-RELIABILITY.md` (both owner-approved) |
| Runbooks | `docs/ops/RELEASE-C-stock-reconciliation.md`, `docs/ops/RELEASE-D-reliable-analytics.md` |

## Owner decisions (do not change without asking Venky)
- Unusual usage = more than **2×** the median daily use of ≥ 3 earlier clean intervals.
- Reviewers = managers + branch owners for their own branch; brand owner / super admin all branches.
- Value usage/stock at the **latest delivery price on or before** the date.
- Incomplete figures: show the known part as `≥ €…` with the reason; **percentages hidden** until complete.
- "Food cost" split into "Purchase spend / sales" and "Cost of goods used / sales".

## Map of the change
**Release C — stock reconciliation**
- `src/lib/inventory/reconciliation.ts` — `reconcileIntervals()` (pure), `transferMoves()` (transfer legs timed from `stock_events`). `countDepletion()` unchanged.
- `src/lib/queries/reconciliation.ts` — `getReconciliation(days, branchId?)`, `addReconciliationReview()` (figures recomputed server-side; HQ branch picker).
- `supabase/migrations/20261021180000_stock_reconciliation_reviews.sql` — insert-only review table, RLS, immutable trigger.
- `src/app/(app)/inventory/Reconciliation.tsx` + tab in `inventory/page.tsx`, EN/DE in `messages.ts`.

**Release D — reliable analytics**
- `src/lib/analytics/coverage.ts` — `figure`, `pctOf`, `missingSalesDays`, `spendFigure`, `latestPrice`.
- `src/lib/inventory/valuation.ts` — `valueUsage`, `valueStock`.
- Rewired: `branch-analytics.ts` (labour/sales/spend coverage, staff cost null without wage, branch comparison `missingWageStaff`), `labor.ts` (`getLaborSummary`, `getMonthlySummary`), `inventory.ts` (`getInventoryAnalytics` rewritten on top of reconciliation).
- UI: `BusinessOverview.tsx`, `(app)/page.tsx`, `analytics`, `overview`, `summary`, `simulator`, `inventory/page.tsx`.

**Leftovers in the same commit**
- 390px: 3-col KPI grids → `repeat(auto-fit, minmax(110px, 1fr))`, 2/4-col → `minmax(0, 1fr)`; `globals.css` `:has(> .data-table) { overflow-x: auto }` + tighter cell padding ≤ 600px.

## Please look hardest at
1. **RLS / access**: `stock_reconciliation_reviews` policies; the HQ picker (`branches` read under RLS, owners only); `getInventoryAnalytics` now calls `getReconciliation` — staff get usage `null` (intended).
2. **Interval maths edge cases**: same-day movements, recounts on one day (last by `created_at` wins), pre-journal transfers (`untimed` with `[created_at, baseline]` window), in-transit (`incoming` with `until`), unit mismatch grouped by category+product.
3. **Berlin dates**: `berlinDateOf()` for `stock_events.recorded_at`; sales/open-day windows (`missingSalesDays` uses days with completed shifts as "open").
4. **Number honesty**: anything that still turns missing into 0, or shows a % on incomplete inputs.
5. **Performance**: `getInventoryAnalytics` reads full purchase history for latest prices (ponytail ceiling noted; readAll 100k cap) and runs the reconciliation query; `stock_events` fetched in chunks of 100 transfer ids.
6. **CSS**: the `:has(> .data-table)` rule — any container that must not scroll/clip?

## How to verify
```powershell
npm ci
npm test                                         # vitest: reconciliation, valuation, coverage + existing
node scripts/checks/stock-reconciliation.cjs     # isolated Postgres (PGlite in .audit-db)
node scripts/checks/stock-reconciliation-query.cjs
node scripts/checks/business.cjs
node scripts/checks/business-ui.cjs
node scripts/checks/inventory-data.cjs
node scripts/checks/workspace-ux.cjs
npx tsc --noEmit
```
Staging (local only, `http://schnitzery.localhost:3100`, synthetic `@example.test` accounts): follow
Step 3 of both runbooks, and check Inventory, Analytics and Clock at 390px width.

## Known limits (by design)
- No item-level sales → "used or lost" cannot be split; not theft detection.
- Cost of goods used % only when all counted products share the same count days.
- Transfers changed before 2026-10-15 are always "Uncertain".

## Rules for the reviewer
- Report findings in `docs/ops/REVIEW-C-D.md` (severity, file:line, repro). Fixes on a new
  `feature/*` branch from `develop`, never directly on `develop`/`main`.
- Never use FarmersFresh (`bjevoybwufubtprkxbvb`); no writes to production; no real payroll,
  attendance, wage or stock records as fixtures; do not create reviews on real data.
- Do not share `.env*`, `.audit-db/`, `.vercel/` or credential files.
- AI features stay deferred.
