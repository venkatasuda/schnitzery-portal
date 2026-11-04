# Manual kitchen production foundation

Route: `/inventory/production`, linked from **Inventory > Stock > Kitchen production** and from preparation planning. Planning and actual production are separate workflows.

## Start now, add real data later

The application does not seed recipes, quantities, yields, prices or business stock. A manager can create and save an incomplete draft immediately, reload it and fill it later. Unknown output and expected quantities remain null, never zero. No recipe, selling price or POS provider is required.

Before posting:

1. Create a finished-stock item with its actual stock unit in the catalog.
2. Receive or manually register the ingredient batches that physically exist. Verify their units and label dates.
3. Open a production draft. Choose the finished item, actual output, production date, verified finished expiry and optional lot number.
4. Optionally enter expected output in the same finished-stock unit. This is a manual expectation, not a confirmed recipe forecast.
5. Select each ingredient batch and its actual withdrawn quantity in that batch's own unit. Different units are never summed or converted. Include normal trimming in the whole withdrawal; do not log that same quantity again as waste.
6. Save the draft, review the saved values and explicitly post it.

Drafts move no stock. Cancelling a draft moves no stock. Unknown or expired ingredient labels, insufficient remaining quantities, missing stock units, future production dates and incomplete output fields block posting. A manager can resolve missing ingredient dates through the existing verified-label workflow.

## Posting and evidence

One database transaction consumes the chosen ingredient quantities, records their batch-action identifiers, creates one finished batch and freezes the posted run. If any write fails, ingredient reductions, input rows, finished stock and audit events all roll back. Stable command identifiers make retries idempotent; a different command cannot post the same run a second time. Draft revisions reject stale edits. Active management and branch permissions apply in the database; browser callers cannot forge production records or output links through direct table writes.

Finished stock appears in Batches & expiry with its production link. The production record retains output quantity/unit, date, expected quantity and canonical ingredient snapshots. A posted record is read-only. Reversal/correction of posted production is not implemented; do not delete audit evidence to fix a mistake.

The stock journal records the completed output once. Reconciliation includes that output as `produced`; ingredient use remains in measured physical-count depletion, rather than being subtracted again as a transfer or waste. No purchase, sales entry or physical count is invented. Same-day count/movement ambiguity still produces an uncertain interval.

Yield difference is actual output minus manual expected output, in the finished item's unit. Percentage requires positive expected output. Missing expectations remain unknown. This difference never automatically becomes waste or a monetary loss.

## Costing boundary

Production cost allocation is deferred. Once a branch has posted production, consumption-cost totals/ratios and complete stock valuation are marked unconfirmed to avoid counting both raw and finished consumption as cost. Purchase spending and explicitly labelled delivery-price estimates remain available. This conservative branch-wide guard stays until a verified raw-to-finished costing method replaces it. Recording purchase prices alone does not complete production costing.

Recipe-linked actual-versus-standard ingredient comparison, automatic recipe allocation, POS consumption, production reversals, formal valuation and full recall/hold workflows are outside this manual foundation.

## Implementation and verification

Migration: `20261104160000_inventory_manual_production.sql`, after the purchasing-pack/return/invoice-cost migrations. It has been applied only to isolated local staging; hosted history and coordinated frontend rollout must be reviewed before release.

Tables: `inventory_production_runs`, `inventory_production_inputs`; `stock_batches.production_id` links finished stock back to its run. Existing operation registry actions `production_save`, `production_post`, `production_cancel` share the existing branch authorization, command idempotency and immutable audit events.

The actual-migration PGlite check in `scripts/checks/receiving-batches.cjs` covers incomplete drafts, no stock changes while saving, one-time posting, output links, immutable posted records, output-failure rollback, stale competing allocations, unknown-label denial, cancellation, forged links and role/account/branch boundaries. The production helper and reconciliation have unit tests; inventory-data checks prove production costs are withheld rather than silently double-counted.

`e2e/inventory-production.e2e.ts` verifies the protected local UI with synthetic data: save/reload an empty draft, manually fill inputs and output, post/reload, inspect lineage, check role/branch access and German phone layout. Browser results and CI are reported separately; this document does not imply a production release.

## Local browser acceptance — 2026-11-04

Passed against the local Docker database and current source: an empty draft saved/reloaded without movement; manual inputs/output posted; exactly one finished batch and linked ingredient action were created; physical count rows stayed unchanged; posted state survived reload; owner access and staff/cross-branch denial held; the editable phone form/posting action and German 375 px saved view had no page overflow; finished-batch and production-record navigation worked. Successful runs took about 2–4 minutes on the local development stack. Synthetic products were archived; immutable local evidence remains for inspection. This is not a production performance or deployment claim.
