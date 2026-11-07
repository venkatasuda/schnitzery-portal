# Live inventory visual review — 7 November 2026

## Scope actually observed

Signed-in demo brand-owner session on the production portal. Inspected valuation, orders, suppliers, returns, stocktakes, an empty Munich catalogue and populated Stuttgart catalogue, kitchen production, recipes, integration setup, sales-import review, consumption and inventory insights. Checked desktop at 1440 x 1000 and mobile at 390 x 844, plus the original narrow view. Opened and discarded an empty supplier dialog; did not create or submit any operational records. Restored the original Munich branch and default viewport.

The reviewed catalogue had no page-level horizontal overflow at mobile width. Supplier dialog controls were aligned. New Settings and business-report destinations loaded in their intended contexts. Populated receipt/valuation forms and all role combinations were not exercised in production.

## Reproduced issues and local fixes

1. Direct-delivery receipt history leaked into Suppliers and Returns. It now renders only on the order list, not supplier/return tasks, an individual order, failed reads or loading states.
2. An empty catalogue said no products matched filters. It now provides an initial setup message, hides irrelevant filters and retains the Add product action. Filtered-empty catalogues retain a reset action.
3. Catalogue repeated its page title and branch. Removed the duplicate heading/branch; reference help is disclosed on demand.
4. Kitchen and recipe screens showed large duplicate navigation-action blocks above the work. Removed sibling-navigation duplicates and moved contextual stock/reference links into help disclosures.
5. A selected mobile task could remain clipped offscreen after navigation. The task strip reveals its current item horizontally on route, task, language or viewport change. It does not scroll the document vertically.
6. Settings-workspace related-action rows could touch the following card. They now share the inventory workspace spacing rule.

## Verification

TypeScript passed, ten focused tests passed and all 25 security/UI/design/accessibility regression scripts passed. Focused tests cover the clipped-task scroll and cleanup, task classification and separated setup/import forms. The UI harness covers receipt placement and catalogue initial-empty wording. Local browser acceptance tests were extended with mobile selected-task bounds and receipt visibility assertions; they still require a healthy local staging portal. These new fixes are local until their review branch is merged and deployed. No SQL migration is required.
