# Release C — Stock reconciliation (design note)

Status: **approved by owner 2026-10-21** (unusual usage = 2× normal; reviewers =
managers + branch owners for their own branch, HQ sees all). Quantities only —
money/valuation is Release D.

## What exists today (verified)
- Counts: `inventory_counts` — one observed `ist` per product per `count_date`.
- In: `inventory_purchases` (`qty`, `purchase_date`). Out: `waste_log` (`qty`, `work_date`).
- Transfers: `stock_transfers` lifecycle **requested → sent → received**
  (or rejected/cancelled = no movement). The row has no sent/received dates, but the
  live evidence journal `stock_events` records every status change with
  `recorded_at`, so *sent at* / *received at* are known for transfers changed since
  the journal went live (2026-10-15). Older transfers: timing unknown.
- `src/lib/inventory/reconciliation.ts → countDepletion(opening, delivered, closing)`
  ignores waste and transfers and just withholds estimates on a negative result.
- No per-item sales exist (`daily_sales` is a single total). **So the app can never
  separate normal usage from loss/theft.** Reconciliation can only show what is
  explained by records and what is not.

## What reconciliation shows
Per branch, per product (catalog identity = category + product + unit), per pair of
consecutive counts A → B:

```
expected = A.ist + delivered + received_in − sent_out − wasted      (dated A < d ≤ B)
used     = expected − B.ist          → "used or lost, not recorded"
```

Status per interval:
| Status | Rule | Meaning |
|---|---|---|
| **Gain — must review** (red) | `B.ist > expected` beyond rounding | Stock appeared from nowhere: missing delivery/transfer record or a miscount |
| **Unusual usage** (amber) | `used/day > 2 × median used/day` of the product's previous ≥3 clean intervals | Possible loss or a recording gap |
| **Uncertain** (grey) | a movement on the same day as a count (order unknown), a pre-journal transfer, a transfer still in transit, or a unit that differs from the count unit | Numbers shown but not judged |
| **OK** | none of the above | — |

Numbers are never invented: unknown or incompatible inputs mark the interval
uncertain instead of being treated as zero.

## Manager review
- Inventory → new **Reconciliation** tab (managers/owners; staff never see it).
- Default view: intervals that need review (gain / unusual), newest first; toggle for all.
- Each row: product, period, opening, +delivered, ±transfers, −waste, closing,
  used-or-lost, status, reasons.
- **Mark reviewed** requires a note (e.g. "delivery from Metro on 14.10 not entered").
  Notes are immutable, branch-scoped, visible to managers/owners of that branch —
  same pattern as offline attendance review. Reviewing never edits stock records;
  fixes are made through the normal count/delivery/waste screens.

## Build plan
1. Pure TS function `reconcileIntervals(counts, purchases, waste, transferMoves)` in
   `src/lib/inventory/reconciliation.ts` (extends the existing helper; keeps
   `countDepletion` behaviour for existing forecasts). Unit-tested with fixtures for
   each status, same-day ambiguity, in-transit, unit mismatch, legacy transfers.
2. Server query `getReconciliation(branch, from, to)` under the caller's RLS; transfer
   timing from `stock_events`.
3. Migration: `stock_reconciliation_reviews` (insert-only, immutable trigger, RLS
   manager + accessible branch, unique per interval) — isolated Postgres test.
4. UI tab + EN/DE strings; staging browser check; release runbook with rollback.

## Not in scope
Valuation/cost (D) · theft detection (impossible without item sales) · automatic
corrections · editing historical counts · POS integration.

## Owner decisions (2026-10-21)
1. Unusual usage threshold: **2× the product's normal daily usage** — accepted.
2. Reviewers: **branch managers + branch owners for their own branch; brand
   owner/super admin all branches** — accepted (DB enforces; HQ branch picker is a follow-up).

Built 2026-10-21 — release steps: [RELEASE-C](ops/RELEASE-C-stock-reconciliation.md).
