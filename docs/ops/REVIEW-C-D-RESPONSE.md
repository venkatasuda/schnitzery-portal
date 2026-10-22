# Response to the Codex review of Releases C + D

Lead response, 2026-10-22, to [REVIEW-C-D.md](REVIEW-C-D.md). All ten findings were
verified against the code and **accepted**; each is fixed and guarded by a check.
The reviewer's bug reproductions (`scripts/audit/review-c-d.cjs`) are converted to
safe-behaviour assertions in `scripts/checks/review-c-d.cjs` (wired into CI).

| # | Finding | Fix | Guard |
|---|---|---|---|
| 1 P1 | Products without intervals vanish from usage completeness | `valueUsage(rows, purchases, required)` — every catalogue (`inventory_master`, active) and counted identity must have an interval, else `missing.counts`; no common span → no COGS % | `valuation.test.ts` "review 1", `review-c-d.cjs`, `inventory-data.cjs` |
| 2 P1 | No counts → complete €0 stock value | Stock value uses the **latest count from all history** per identity; catalogue products never counted → `missing.counts`; no counts at all → `null` | `valuation.test.ts` "review 2", `review-c-d.cjs` |
| 3 P1 | Different units same day merged as recount | Days keep the set of units seen; a day with >1 unit makes its intervals `uncertain · unit` | `reconciliation.test.ts` "review 3" |
| 4 P1 | Opening count during transit double-counts | In-transit check covers **both** boundaries (transit open at A or at B) | `reconciliation.test.ts` "review 4" (+ updated transit cases) |
| 5 P2 | Invalid count silently bridged | Invalid counts kept; a bridged interval spanning one is `uncertain · invalid` | `reconciliation.test.ts` "review 5" |
| 6 P2 | Deleted transfers' journal ignored | Reconciliation also reads `stock_events` for the branch in the period; evidence for transfers with no surviving row that ever reached sent/received → untimed movement (product-scoped; all products if the product is unknown) | `stock-reconciliation-query.cjs`, `review-c-d.cjs` |
| 7 P2 | Review stale-check partial; save could attach to unseen figures | `reviewSnapshot()` / `sameSnapshot()` = all figures + status + sorted reasons; UI compares full snapshot; save sends the snapshot the reviewer saw and the server refuses with `changed` if it differs | `stock-reconciliation-query.cjs`, `review-c-d.cjs` |
| 8 P2 | Direct authenticated INSERT of arbitrary figures | Migration `20261022090000_stock_reviews_trusted_insert.sql`: INSERT revoked from `authenticated`, insert policy dropped; writes only via `record_stock_reconciliation_review` (service-role only, re-checks manager + branch + count ownership, actor attributed) — same pattern as `set_payroll_approval_atomic` | `stock-reconciliation.cjs` (isolated Postgres: direct insert and direct RPC refused) |
| 9 P2 | Future-dated records counted as current actuals | `actualTo = min(period end, Berlin today)` for attendance, sales, purchases, waste in branch analytics; monthly summary and labour summary capped the same way | `business.cjs`, `review-c-d.cjs` |
| 10 P2 | CSV drops completeness; "Food cost %" label | Monthly summary CSV adds per-employee "Wage confirmed", status + missing counts per money figure, ratios labelled "Purchase spend / sales %" / "Labor + purchases %" with "blank = inputs incomplete" | `review-c-d.cjs` |

## Release impact
- **New migration** `20261022090000_stock_reviews_trusted_insert.sql` — apply after
  `20261021180000` and **before** deploying this code (the server now calls the new
  function; without it, saving a review fails with "could not be saved").
- No change to approved owner decisions.

## Not done here (reviewer's items 4–5, acceptance work)
- Browser acceptance at desktop + 390px, German, keyboard, errors (needs local staging running).
- Query timing of the full-history purchase/count lookups on representative data.
