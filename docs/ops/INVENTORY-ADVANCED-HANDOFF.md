# Advanced inventory release

## What changed

### Transfers → choose batches and dispatch

Source managers allocate exact, unexpired batches before dispatch. Allocation must equal the requested quantity. Destination managers record the actual quantity for every lot. Accepted quantities create destination batches with the original expiry, lot number and a frozen operational cost reference; shortages remain visible in the transfer evidence. These movements do not create purchase spending or revenue. Repeated commands do not duplicate stock.

Legacy transfers already sent without batch information retain their original receipt path. New batch-linked transfers must use **Transfer batches / receipt**. Product-only dispatch is intentionally blocked. Source and destination permissions are checked in the database; browser clients cannot forge lineage or edit the transfer journal.

### Reports → recipe consumption

Create a till connection, then use the normalized export importer or the existing signed ingestion endpoint. Item exports use this structure:

```json
{
  "format": "schnitzery-pos-items-v1",
  "external_id": "unique-provider-export-reference",
  "currency": "EUR",
  "days": [{"date": "2026-01-01", "gross_sales": 100}],
  "items": [{"date": "2026-01-01", "sku": "MENU-SKU", "qty": 2}]
}
```

The example is documentation, not seeded business data. Daily-only exports remain supported under `schnitzery-pos-daily-v1` and cannot imply ingredient quantities. Each SKU/date must be unique and quantities must be positive. Refunds require reconciliation rather than automatic restocking.

Managers approve daily totals separately, then map each SKU to an immutable recipe version or a reviewed non-stock item such as a delivery fee. Consumption requires an approved item export, the reviewed mapping versions, a note and explicit confirmation. Quantities scale by sold portions. FEFO allocation uses only active, dated, unexpired lots received by the sale date. Missing mappings or insufficient stock roll back the entire stock posting.

Prepared dishes must reference finished-stock ingredients when raw ingredients were already consumed during kitchen production. Mapping a sale to those raw ingredients again would double-count consumption. This is theoretical recipe consumption, not a measurement of physical kitchen use.

Mistaken stock posts can be reversed with a reason, preserving the original journal. Reversal restores only safe batch balances and does not rewrite daily sales. A corrected consumption can then be posted. Existing sales dates are not silently overwritten.

### Reports → valuation close

Review net cost per stock unit for each batch against real source evidence. Reviews are append-only versions; unknown costs are not assumed to be zero. The preview includes on-hand batches and dispatched stock still in transit. Closing requires reviewed costs and today's physical counts matching tracked on-hand quantities for every catalogue/batch identity.

An approved close freezes quantities, net prices, cost-review IDs and values. Later invoice or cost changes do not rewrite it. Saved closes export CSV with spreadsheet formula escaping. This values tracked inventory using reviewed batch costs; it is not a complete accounting ledger, tax filing or profit statement. Historical balances are not reconstructed from guesses. External accounting integration remains provider-dependent.

## Migrations and rollout

Apply these in order, then deploy the matching frontend and refresh old transfer screens:

1. `20261105162633_inventory_lot_transfers.sql`
2. `20261105163333_inventory_pos_recipe_consumption.sql`
3. `20261105163337_inventory_valuation_closes.sql`

Use the tested `postgres` deployment principal; existing functions retain their ownership on replacement. Restore-test a current private backup first. Never replay private historical credential/demo migrations. Do not seed sample costs into production.

## Verification

- `node scripts/checks/inventory-advanced.cjs`: existing receiving/production scenarios plus rollback-only transfer, POS-stock and valuation SQL fixtures.
- `supabase/tests/inventory_lot_transfers.sql`: branch/staff restrictions, allocation rollback, expiry lineage, shortage and retry safety.
- `supabase/tests/inventory_pos_stock.sql`: item import, mapping, scaled consumption, reversal/repost, retry and authorization checks.
- `supabase/tests/inventory_valuation_closes.sql`: unknown-price blocking, review revisions and frozen valuation history.
- Focused Vitest tests cover parsing, transferred costs/lineage and CSV escaping.
- `e2e/inventory-advanced.e2e.ts`: local-only browser workflow on a fresh synthetic branch. Audited journals remain in staging; the test disables its account and branch afterwards.
- Existing transfer browser/SQL tests now allocate real synthetic batches.

Run mutating browser and SQL tests only on isolated local staging. The schema and tests being implemented does not mean that a live POS provider is connected or every browser/device has passed acceptance. Record actual run results in the release review.

## Recorded checks � 6 November 2026

- All 12 inventory migrations applied successfully to the network-isolated backup restore. Original 96 table row counts matched; foreign keys validated.
- Native PostgreSQL count-session, operations, lot-transfer, POS-stock and valuation tests passed with rollback-only fixtures.
- Advanced in-memory SQL acceptance passed, including the existing receiving/production tests.
- Focused form-label, CSV and POS parsing checks passed; TypeScript passed.
- Browser write flow reached posted consumption, resumed/published physical count and saved valuation. Final export disclosure and cross-branch transfer checks are being rerun; browser acceptance remains open until results are recorded.
- PR #88 was merged at 08:39 UTC on 6 November after clean CI build, lint, type-check, unit/security checks and Vercel preview. Follow-up fixes require a separate PR and new CI run.

These three migrations were not applied to production by this work. Confirm production migration history before rollout; merging PR #88 does not apply SQL migrations.
