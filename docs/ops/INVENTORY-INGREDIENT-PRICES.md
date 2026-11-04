# Ingredient reference prices and updates

Route: `/inventory/prices`, linked from Inventory > Stock and Recipe costing.

## Keep business data private

The repository is public. Actual invoice rows are not embedded in code, fixtures or the frontend bundle. The owner-supplied list was prepared as a separate private JSON import file and loaded into isolated local staging as 39 unconfirmed rows. No live prices, purchases, stock or production records were created by that import.

Price imports and price versions are stored under active management/branch RLS, with authenticated read-only table grants. Server actions enforce the selected branch; checked database functions enforce role, active account and accessible branch again. Imports are immutable and repeated content deduplicates. The same business file may deliberately be imported into another authorized branch for its own review; no automatic cross-branch mapping occurs.

## Workflow

1. Upload a prepared `schnitzery-price-reference-v1` JSON file under **Import references for review**. Each row retains its item, source, article number, pack description, quoted price/quantity/unit, tax basis, VAT, observed date, original bought-quantity/line total and notes. Null means unknown, not zero.
2. Open the imported list and choose **Review and map product**. Select the actual catalog item. Compatible mass/volume unit conversions may prefill stock quantity; density, pack ambiguity and pieces-versus-containers are never guessed.
3. Verify the stock quantity covered by the price, price amount in EUR, net/gross basis, VAT rate, effective date, source and review note. Gross requires VAT. Unknown dates/prices/assumed quantities must be supplied explicitly. Check the review box and save.
4. For a later change, open that item's price history and choose **Update with new version**. Enter the new amount, source/date and reason. This appends a version. Older prices and original invoice evidence remain intact.

Imported references are never automatically activated. Online/proxy, undated and outdated sources stay labelled. Rounding discrepancies remain notes for review; the system does not force rounded displayed unit prices to match invoice totals. Hygiene/packaging items can be priced without pretending they are recipe ingredients.

## How features use these prices

Recipe costing uses the newest applicable date from actual recorded deliveries or reviewed reference prices. Actual deliveries take precedence on the same date; multiple receipts on that latest day retain the existing quantity-weighted calculation. Among reference prices effective on the same date, the highest revision wins. Future prices wait until their effective date. Product ID and the frozen product/category/unit identity must match.

Recipe entry displays whether a price comes from a delivery or a reference estimate, its date and reference source. Saved recipe quantity versions remain unchanged; their displayed cost is explicitly a current estimate, not historic profitability. Net-price review still gates contribution/percentage figures.

Reference updates do not change spending, receipts, inventory valuation or production costs. Correct actual received invoice costs through **Purchasing > Invoice cost & history**. The manual-production cost-allocation guard remains in place until that separate capability is implemented.

## Integrity and concurrency

Price versions retain entered quantity/price, VAT basis/rate, normalized net unit price, effective date, source/type, review note, optional original import-row link, revision, actor and creation time. A product-row lock and expected revision reject stale edits. Stable command IDs make identical retries idempotent; changed command payloads are rejected. Direct authenticated insert/update/delete is not allowed. Archived products and products without stock units cannot receive new reference prices.

## Verification and release

Migration: `20261104190000_inventory_price_versions.sql`. Applied only to local staging. Coordinate database migration and frontend release; no production deployment is implied.

`scripts/checks/ingredient-prices.cjs` exercises the actual migration: private imports, deduplication, unknown metadata, malformed-row denial, reviewed dates, net/gross normalization, stale/retry protection, immutable older versions, no invented purchases and staff/inactive/cross-branch denial. Pure tests cover date precedence, same-day actual-price preference, future exclusion, revision selection, unit mismatch and null prices.

`e2e/inventory-prices.e2e.ts` covers import/review, version update, recalculated recipe estimates, no stock/purchases, role/branch access and German phone layout. It uses synthetic data only. The real owner file remains outside this public repository and private CI fixtures.

Local verification on 4 November 2026: TypeScript passed, 132 unit tests passed, the ingredient-price database check and related inventory regressions passed, and the browser workflow passed (including the 375px German editor). The phone screenshot was visually reviewed. These results do not establish production deployment or production verification.
