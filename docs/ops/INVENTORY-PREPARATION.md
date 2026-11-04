# Kitchen preparation and recipe yields

Implemented route: `/inventory/preparation`, linked from Inventory > Stock and Recipe costing. This is preparation planning, not a production stock ledger.

Actual manual production now has a separate [draft-and-post workflow](INVENTORY-MANUAL-PRODUCTION.md). It can be configured without recipes or prices; planning still does not move stock.

## Workflow

1. Save a recipe version with quantities of raw ingredients. A selling price may be left blank (stored as null, never inferred as zero). Ingredient costing can still be calculated when purchase prices are known; contribution and percentages require a selling price and the existing net-price review.
2. Select that saved recipe, enter its usable finished output and output unit (`kg`, `l`, `pcs`), then enter expected trimming in each ingredient's frozen stock unit. Enter zero explicitly for no trimming. Losses cannot exceed the raw input. Litres and kilograms are never summed or converted automatically.
3. Save an immutable yield version, confirmed only after the manager verifies output and trimming. Unconfirmed versions are retained and visible, but cannot be used for a daily plan.
4. Pick a preparation date and confirmed yield. Enter service demand, separate reserve target, usable prepared stock and incoming prepared stock available before service. All four values must be explicitly supplied in the finished-output unit; raw ingredient deliveries are not incoming prepared food.
5. Required output = max(0, demand + reserve - usable - incoming). Round up to whole batches. Show the rounding surplus, raw ingredient requirements and included trimming. Trimming is already in raw ingredients, not added again.
6. Save a dated immutable plan revision. The newest revision per recipe version/date is active. Earlier revisions remain visible; revisions are never added together. Different saved recipe versions are separate planning identities and must not be assumed to be one menu item.

The expandable Stuttgart reference transcribes daily targets from PDF page 7. It is labelled as a reference, not a demand forecast, approved branch default or confirmed recipe yield. It does not automatically populate business records.

## Example

Parmesan: 2.4 kg raw, 0.4 kg trimming, 2 kg usable per batch. Demand 4 kg + reserve 2 kg - usable prepared stock 1 kg - incoming prepared stock 1 kg = 4 kg to prepare. Two whole batches require 4.8 kg raw including 0.8 kg expected rind loss. These are plan figures, not posted purchases, waste or stock movements.

## Security and persistence

- Active manager, branch owner, brand owner or super admin, with accessible-branch validation in server actions and private checked-definer RPCs. Shared recipe/preparation server scope uses the existing branch policy.
- RLS restricts reads; authenticated clients have no table insert/update/delete grants. Public wrappers are security invoker; private functions use an empty search path and explicit identity/role/branch checks.
- UUID commands, transaction advisory locks and exact payload comparisons make retries idempotent; a changed payload with the same ID is a permanent 409 conflict.
- Saved recipe versions freeze raw identities/quantities; yield and plan records reference those immutable versions. No editing past records through the browser.
- No automatic stock deduction, waste posting, purchase orders, recipe-to-sales consumption or manufacturing completion is claimed. Expected trimming is not actual waste. Usable/incoming stock is a manually checked planning snapshot.

## Release and verification

Apply in order after the existing recipe migrations:

- `20261103101702_inventory_preparation_planning.sql`
- `20261103102620_inventory_recipe_optional_selling_price.sql`

Both were applied only to isolated local Docker staging. Production application is not confirmed.

Runnable checks: `npm test`, `node scripts/checks/recipe-costing.cjs`, `npm run e2e -- inventory-preparation.e2e.ts` (local staging only).

The isolated SQL check covers trimming bounds, unconfirmed-yield denial, immutable writes, idempotency/conflicts, staff/inactive/cross-branch denial and unknown selling-price persistence. Unit checks cover reserve carryover, whole batches, decimal rounding, surplus and invalid quantities. Browser verification results are recorded after the final candidate run; earlier recipe/insights acceptance does not by itself validate this new page.

Rollback: revert frontend navigation/page if preparation smoke checks fail, leaving immutable data and additive schema intact. Do not drop preparation records to roll back a frontend release.

Remaining: production recording/actual yield capture, automatic ingredient stock availability, purchase-pack conversions, menu-item sales mapping, supplier credits and lot traceability. No completion of the full inventory roadmap is claimed.

## Acceptance recorded 2026-11-03

- Real local Docker migration application succeeded. Isolated SQL security and retry checks passed, including null selling prices.
- Full unit suite before final documentation updates: 117 tests across 22 files passed; changed costing/preparation unit checks also passed after optional-price support.
- TypeScript, inventory data/UI regressions, static accessibility, loading safety and design-token checks passed.
- Authenticated preparation browser test passed twice. It saved a confirmed yield, saved the two-batch Parmesan plan, reloaded it, verified raw/trim quantities, verified German 375 px layout, denied staff and hid the recipe from another branch. Synthetic fixture cleanup completed. Final run included the saved plan on the German phone view.
- The final browser run took 11.5 minutes on the slow local development stack, versus 2.6 minutes on the earlier run. No production performance claim is made. The source snapshot used the same-drive E: candidate to avoid the known Windows cross-drive webpack issue.
- No production schema or main branch change was made by this work. CI and hosted migration/deployment checks are still required before release.
