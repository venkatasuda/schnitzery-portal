# Connected purchasing workflows

## Purchase packs

Open **Inventory > Stock > Catalog > Purchase packs** on an existing product. Verify the stock quantity in one supplier pack. Saving creates an immutable version; products without a stock unit cannot configure packs.

In **Purchasing > New purchase order**, select the product and order unit. Quantity and price refer to that selected unit. The server resolves the saved pack, calculates stock quantity/unit price and freezes entered quantity, pack label, conversion and entered price. Order totals use entered quantity and entered price, avoiding repeated-decimal converted prices in totals. New pack versions do not change old orders or retries.

Receiving and returns use explicitly labelled stock units, including partial packs. Three cases of six litres means 18 litres ordered; receiving 7.5 litres leaves 10.5 outstanding. Batch allocations use litres too. Direct receiving still uses stock units; pack entry there, density conversions and supplier defaults are not implemented.

New purchase-order references use the full command identifier, preventing collisions from the earlier eight-character prefix. Existing references remain unchanged.

## Supplier returns and credits

Open **Purchasing > Returns & credits**. Record goods only after they have been sent back. Choose a receipt-linked batch, quantity, date, reference and reason. The server derives supplier/product from the original purchase, locks the batch and reduces remaining quantity atomically. It refuses over-returns, foreign branches and unlinked manual batches. Returning the entire remainder closes the batch as `returned`; it does not create waste or a refund.

Returns appear in the immutable stock journal and as a separate outgoing quantity in reconciliation, excluded from unexplained consumption. Same-day ambiguity/unit checks still apply. Older review snapshots without returns compare as zero; a changed balance makes a review stale.

Open a saved return to record a supplier credit document: reference, date, EUR amount, explicit net/gross/unconfirmed tax basis and evidence. Credits never move stock or rewrite purchases. They do not prove payment or a reconciled supplier balance. Net/gross amounts are not combined. One credit document currently links to one return; multi-return allocation, reversals and payment reconciliation remain unfinished.

## Later invoice costs

In saved order receipts or direct-delivery receipts, select **Invoice cost & history** on an accepted line. Enter the received line's invoice TOTAL, reference and reason. A reviewed management command changes only current purchase cost. Original receipt snapshots remain intact. Immutable operation/stock events retain previous and new evidence, actor and time; the dialog displays correction history.

Unknown costs remain null until confirmed; zero requires explicit entry. Expected previous cost prevents stale overwrites. Identical command retries are idempotent. Quantities, dates, order prices, batches and credits do not change. Current spending and price estimates reflect corrections; they are not frozen accounting statements or a tax ledger.

## Database and release

Apply after `20261103125715_inventory_receiving_batches.sql`:

1. `20261104123000_inventory_purchase_packs.sql`
2. `20261104133000_inventory_supplier_returns.sql`
3. `20261104143000_inventory_invoice_costs.sql`

New tables enable RLS with authenticated read access only. Database commands enforce active management/branch permissions and write with existing command/audit transactions. These migrations have been applied only locally. Hosted migration history and a coordinated frontend rollout require verification before release.

`scripts/checks/receiving-batches.cjs` applies actual stock journal/workflow migrations. The expanded local check passed conversions, old pack versions, partial receipts, retries, forged writes, duplicate/over-returns, atomic rollback, credit/stock separation, cost history/stale edits and role/branch restrictions. Unit/reconciliation checks passed. Browser acceptance is tracked separately and remains a release gate.

## Local acceptance recorded 2026-11-04

- 125 unit tests in 24 files, TypeScript and the expanded database checks passed. Static accessibility, loader safety, translations, design ratchet and inventory/reconciliation regressions passed.
- The purchasing browser workflow passed: pack setup, pack-based order, two partial receipts (one with unknown cost), physical supplier return, separate credit, manager/staff/owner permissions, branch isolation and German mobile purchasing layout.
- Direct-receiving browser acceptance passed: split expiry lots, no duplicate physical count, partial use/waste, missing-date resolution, late invoice cost entry/history, unchanged quantities, German 375 px layout and cross-branch isolation.
- Browser tests used real local Supabase authentication with synthetic accounts. They do not establish login-form behavior, production performance, exhaustive browser/device coverage or a production release. Each final workflow took about four minutes on the local development stack.
- Audited synthetic receipts, credits and movements remain in local staging for review; test products are archived. No real production records were changed.

## Remaining scope

Actual kitchen production, item-level POS consumption, lot-allocated transfers, recalls/holds, accounting valuation, automatic integrations, full profit reporting, shared unsaved-navigation protection and production load/restore evidence remain unfinished. This batch does not complete the full inventory roadmap.
