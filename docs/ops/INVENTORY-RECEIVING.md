# Receiving deliveries and tracking expiry

## Where staff go

- **Inventory > Purchasing > Receive a delivery:** record a delivery without an existing purchase order. Enter supplier, invoice/reference, delivery date and accepted/rejected quantities. Split accepted quantities into batches with their own expiry dates and lot numbers.
- **Purchasing > open an order > Receive goods:** receive against that order, including partial deliveries and discrepancies. Do not also enter the same delivery through direct receiving.
- **Inventory > Stock > Batches & expiry:** see remaining tracked quantities, earliest expiry first, missing dates and batch history. Search by product, lot or receipt reference. Record partial use or waste here.
- **Stock count:** record what is physically present. A count is a reconciliation observation; it is not the place to receive a delivery.

## Data and safety

Accepted quantities, purchase evidence and linked batches are written in one database transaction. Batch allocations must equal the accepted quantity. Rejected goods do not become stock. Stable command identifiers make repeated submissions idempotent; conflicting reuse is rejected. Supplier/reference checks protect against duplicate receipts.

An unknown invoice cost stays null, not zero. An unknown expiry date requires a reason and appears in the missing-date filter. A manager can record the verified missing date later with audit evidence; this operation cannot extend an existing expiry date.

Remaining quantity is separate from original received quantity. Recording use reduces remaining quantity. Recording waste reduces remaining quantity and creates its waste entry atomically: do not log that waste a second time elsewhere. Over-consumption is rejected. Closing a batch acts on its remaining quantity.

Manual registration of existing stock creates batch tracking only; it does not create another purchase. Legacy authenticated delivery inserts create a batch with an explicit missing-expiry reason. Historical deliveries are not silently backfilled into current stock.

Active account and branch permissions apply in the database. Receiving requires management access. Receipt links and received purchase evidence cannot be forged or freely edited through authenticated table access. Batch action history records actor, time, quantity and command identity.

## Limits and release status

Tracked batches are not proof that all physical stock has been registered. Sales, transfers and kitchen preparation do not yet automatically allocate consumption to individual batches. Staff must record batch use and reconcile physical counts. Quantities in incompatible units are never combined or guessed.

The migration is `20261103125715_inventory_receiving_batches.sql`. This work is on the inventory review branch; do not assume it is deployed. Release requires migration review, successful checks for the final commit, and coordinated database/frontend rollout.

## Verification

`scripts/checks/receiving-batches.cjs` exercises actual migrations in an isolated database, including receipt splits, retries, rollback, unknown costs, partial use/waste, field tampering and branch restrictions.

`e2e/inventory-receiving-batches.e2e.ts` covers direct receiving, expiry ordering, partial use/waste, missing-date resolution, German mobile layout and branch switching against local staging. The saved direct-receiving run passed. `e2e/inventory-workspace.e2e.ts` also covers purchase-order receiving; verify its latest run separately before release.
