# Inventory owner analysis and recipe costing

Implementation date: 2026-11-01. Source implementation is local; no production migration or frontend deployment was performed for this change.

## Implemented together

- `/inventory/insights`: branch-scoped 7/30/90-day analysis, English/German, readable owner summary, count/price coverage, last-count stock estimate, date-priced recorded waste, purchase spending, expiry-register exposure, open-order commitment, existing reconciled consumption and matching-span sales ratio.
- Ranked review actions link to inventory workflows. Exposure figures are not promised savings and must not be added together. Missing inputs stay unknown or explicitly partial.
- Product rows show count/date, estimate, latest delivery price/date, comparison against the previous priced day and target-based reorder quantity. Stale counts suppress the reorder suggestion. Prices/counts older than the 365-day evidence window are unknown.
- Supplier analysis uses the selected order-creation cohort, accepted receipt evidence before each deadline and individual line ratios. It never adds kilograms, litres and pieces into a meaningless quantity total. Due-today orders are not prematurely classified late. Missing order lines make commitments incomplete.
- Equal-length prior-period recorded purchases and waste comparison; today's partial-day limitation is visible. Waste prices use the latest known price on/before the waste date. No missing price is silently replaced by zero.
- Stock CSV export retains raw quantities, units, branch, period, count dates and estimated prices/values. Spreadsheet formula prefixes and CSV quotation/newline characters are neutralized/escaped.
- `/inventory/recipes`: ingredient quantities, batch yield/portions, net selling price, compatible gram/kilogram and millilitre/litre conversions, current ingredient cost/portion and explicitly reviewed ingredient contribution before labour/overheads. Incompatible mass/volume/case conversions are rejected.
- Recipe saves append immutable versions. The database validates active-role and branch access, resolves ingredients from its own catalogue, computes base-unit quantities and freezes ingredient identity/unit/quantity. Command retries are idempotent; conflicting payloads are rejected. Direct client inserts, updates and deletes are denied. Copying an old version creates a new draft and requires a fresh price-basis review.
- Purchase-price tax basis must be explicitly reviewed before contribution or ingredient percentages appear. A saved historic review is not automatically reused to claim a margin at today's prices. No historical profitability, net profit, automatic recipe stock deduction or physical stock restoration is claimed.
- Existing inventory Overview/Reports and BusinessOverview link to the analysis; the five main inventory areas remain.

## Evidence and limits

- Full source unit suite: 103 tests passed across 16 files.
- `scripts/checks/recipe-costing.cjs`: real migration executed in isolated PGlite. Compatible conversion, immutable snapshots, direct-write denial, staff/inactive/cross-branch denial, checked private-helper access and idempotent retries passed.
- Existing inventory data/UI, business UI and workspace regressions passed. Static accessibility, loader-safety and design-token ratchets passed. TypeScript passed.
- Production build passed compilation, TypeScript and all 78 routes; final packaging results are recorded when complete.
- Synthetic source-rendered English desktop and German phone review performed with real shared CSS. Phone preview had no page-level horizontal overflow (375px content/viewport); tables retain their own scroll regions. This is a static visual review, not an authenticated end-to-end test of saved recipes, filtering, export or server round trips.
- No business records, wages or production authentication settings were changed by this work. AI stays deferred.

## Release dependency

Apply `supabase/migrations/20261101074231_inventory_recipe_costing.sql` in version order to staging first, then test save/retry/role denial through the real API and browser. The recipe page reports unavailability if its schema is absent. The insight report itself reads existing tables. Run the complete release checks and deploy the frontend only after staging acceptance. Do not claim the recipe workflow is production-ready based only on the isolated SQL suite.

## Remaining scope from the larger proposal

The following were not implemented by this change and must not be represented as finished:

1. Purchase-pack configuration and frozen conversion factors throughout ordering, partial receiving and returns. Recipe SI-unit conversion does not replace this.
2. Item-level sales import/mapping, effective recipe versions bound to sale events, refund/void semantics and actual-versus-theoretical consumption. Existing daily-sales import remains available, but is not an item-level POS feed.
3. Automatic POS/accounting connectors. A provider and integration credentials/contract are still unknown; no connector has been fabricated.
4. Complete lot allocation/traceability, supplier returns and credits, formal stock-ledger accounting valuation and slow/dead-stock classification from proven movement coverage.
5. HQ inventory comparison using normalized branch coverage, demand forecasting with backtesting, overhead inputs and a complete profit/loss report. Existing branch dashboards are not proof of these new measures.

The current result is a usable analysis and costing increment, not completion of the entire advanced inventory roadmap.
