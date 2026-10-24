# Inventory implementation and combined acceptance

Updated 2026-10-24. Scope: the ten-area inventory list agreed in this chat. Changes are local and on isolated Schnitzery staging, not production. AI remains disabled in the test candidate.

## Current scope

| Area | Implementation |
| --- | --- |
| Five areas | Overview / Stock / Purchasing / Movements / Reports, shared navigation across supporting tasks |
| Counts and context | Count coverage, unknown versus zero, filters, branch/date labels and stale-branch protection |
| Planning draft | Price completeness, fractional prices, persistent errors, stale-response protection, consistent exports |
| Saved count sessions | Resume, revisions, review/completion, exactly-once publication, immutable-to-clients events; see [count-session handoff](INVENTORY-COUNT-SESSIONS.md) |
| Product editor | Name/category/unit, target, reorder point, minimum suggested quantity, preferred supplier and archive; changing identity creates a replacement and preserves old history |
| Suppliers and saved orders | Supplier name/contact/lead time, active/archive state; saved draft → approved → manually marked sent → partial/closed or cancelled; recorded action notes and timeline |
| Receiving | Multiple lines per purchase-order receipt, actual accepted/rejected quantities, actual accepted line costs, mandatory discrepancy explanations, unique delivery references and atomic posting |
| Movement corrections | Actual transfer receipt quantities and side-specific authorization; manager waste correction or zero-to-void with retained evidence; reconciliation detail dialog and product/date-filtered movement ledger |
| Browser acceptance | Prepared combined tests and manual walkthrough below; not yet claimed passed |
| Build and release | Final candidate build/result recorded below; production migration/deployment not performed |

## Entry points

- `/inventory`: operational overview.
- `/inventory?view=count`: quick counting; `/inventory/counts`: saved count sessions.
- `/inventory?view=catalog`: the product editor. Its filters apply to the catalogue, not count entries.
- `/inventory?view=forecast`: reorder planning, using configured thresholds/minimum quantities and supplier lead time when present.
- `/inventory/purchasing`: saved orders, supplier directory, order activity and receiving. A saved order has `?order=<uuid>`.
- `/inventory/order`: explicitly unsaved, exportable planning draft. It links to saved ordering; its temporary edits are not silently imported as a saved order.
- `/transfers`, `/waste`: actual receipt/correction dialogs.
- `/inventory?view=reconcile`: compact exception queue and review details. Reviews do not adjust physical stock.
- `/inventory?view=history`: movement evidence; product and recorded-date filters. Dates filter recording time in Berlin, not a promise of the original business date.

## Rules that matter

- Order quantities/prices/supplier details are frozen after approval. Supplier edits do not rewrite existing orders. Draft editing requires the current revision.
- "Mark sent" records a manual external sending reference. It sends no email and places no external order automatically.
- Receipt cost means total cost of accepted goods on that line, not unit price. Unknown planning prices remain unknown; actual receiving requires explicit non-negative costs. Rejected goods do not become purchases or accepted stock.
- Partial, over- and rejected deliveries require explanations. Duplicate command retries return the original result; duplicate delivery references on one order are rejected. A failed line rolls back the whole receipt, purchase rows, quantities and evidence.
- A partial order can be closed with a reason to clear its outstanding balance. A transfer shortage closes that transfer's receipt once; it does not create a promised second delivery or automatic waste entry.
- Product identity changes archive-and-replace; there is no implicit unit conversion or copying of opening balances. Existing labels for archived products cannot silently count that archived identity.
- Waste correction is a correction to recorded waste, not a reversal of physical waste. It changes historical reports; stock events retain before/after evidence and the correction event retains the manager's reason. A void removes the active waste entry while keeping that evidence.
- Authenticated users have read-only grants on new operational records, governed by manager/active-account/branch RLS. Checked RPC transactions perform writes. Staff cannot read the new manager records or mutate them. Private definer functions authenticate the actor and independently authorize branch access; no submitted actor identity or service key is trusted.
- Ordinary direct transfer updates are guarded too. Only the source can dispatch/reject, only the destination can cancel/receive, and closed receipt evidence cannot be rewritten.

## Verification

- Eight targeted suites passed: inventory data/forecast, order drafts, saved counts, inventory operations, workspace UX, stock history UI/boundaries, reconciliation queries and review C/D regressions.
- SQL assertions in `supabase/tests/inventory_operations.sql` passed on `supabase_db_schnitzery-local-staging`: supplier/product identity, order states, fractional/unknown prices, partial multi-line receipts, duplicate retries/references, failed-line rollback, stale revisions, waste evidence, transfer side permissions, manager/owner/staff access and inactive-account denial.
- `supabase/tests/inventory_count_sessions.sql` passed again after the operations migration, including the catalogue/count guards. Both SQL suites roll back their fixtures and evidence.
- Staging security advisor: no issues found.
- Real local Supabase API smoke checks passed for manager A, denied cross-branch manager B, denied staff and allowed brand owner. They also verified the catalogue/supplier relation and saved-count RPC are visible through PostgREST, not just callable from psql. Probes deliberately use unsupported actions and create no inventory records.
- Full source unit suite: **78 tests passed across 12 files** with `vitest run --maxWorkers 2`.
- Source TypeScript passed. Final full candidate build and unit-suite results are appended after completion; the earlier count-session-only build is not substituted for this release.
- The test runner's missing locked Rolldown native package was restored from integrity-verified local npm cache. Vitest now has the same `@` source alias as Next and scans source tests rather than ignored staging copies. No package upgrade was introduced.

## Combined browser test

The isolated candidate uses local Supabase at port **55321** and serves at **http://schnitzery.localhost:3108** once its production build completes. It does not point at production. Synthetic accounts remain in the ignored local staging account file; do not include their passwords or keys in a review bundle.

Prepared browser tests: `e2e/inventory-workspace.e2e.ts`. Existing daily-flow and multi-branch tests now use the new product editor and actual transfer receiving. Tests refuse remote hosts through `e2e/local.ts`. Set `E2E_BASE_URL` to the candidate URL before running `npm run e2e`. These tests have not yet been executed in a browser in this pass; the desktop browser-control connection timed out.

Joint walkthrough:

1. Manager: create a supplier and a product; set unit, target, reorder point, minimum quantity and supplier. Refresh and check persistence. Rename/change unit and verify older order/count identities remain unchanged.
2. Start a saved count, save only some quantities, reload/resume, and check blanks stay unknown. Open a second tab and confirm stale saves fail. Complete only after all quantities are saved and reviewed.
3. Create a multi-line order with known, unknown and explicit zero prices. Save/reload; approve; mark sent using an external reference. Check the timeline.
4. Post a partial receipt with rejected goods and actual line costs. Inspect outstanding quantities and purchase evidence. Repeat/retry and verify no duplicate purchase. Finish the remaining receipt or close it with a reason.
5. Two branch managers: request, dispatch and record a short transfer receipt. Verify source sent quantity and destination actual receipt remain distinct; the wrong side cannot act.
6. Correct and void a synthetic waste entry with a reason. Inspect the original evidence in history and confirm affected reconciliation reviews become stale when their figures change.
7. Staff, unrelated branch manager and brand owner: verify denied versus allowed access. Repeat key screens in English/German, keyboard-only, desktop and 390px mobile; check dialogs, focus return, contained table scrolling and error recovery.

Browser tests intentionally retain tagged synthetic order/receipt history rather than deleting audit evidence. Product cleanup archives test products. A failed count test may leave its saved draft for inspection; a later test skips rather than overwriting an existing draft.

## Deployment and explicit limits

Apply `20261024034605_inventory_count_sessions.sql` then `20261024041539_inventory_operations.sql` to the intended environment before releasing this UI. Review other pending project migrations separately; this inventory change does not claim they are already deployed. Production remains unchanged until combined acceptance and rollout.

This release uses purchase-order receiving; the existing quick-delivery form remains for unplanned single-line entries. Automatic supplier emails, invoice attachments, multi-arrival transfer receipts, partial batch consumption, unit conversions and warehouse/location modelling are not included. They are not implied by the current buttons or statuses.
