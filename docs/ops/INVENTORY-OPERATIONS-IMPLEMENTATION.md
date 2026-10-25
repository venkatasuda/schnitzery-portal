# Inventory implementation and combined acceptance

Updated 2026-10-25. Scope: the ten-area inventory list agreed in this chat and the shared responsive shell. Frontend changes are local and on isolated staging; production batch security and migration-history reconciliation are complete. Frontend deployment still awaits Vercel team access. AI remains disabled in the test candidate.

Advanced additions and their acceptance rules are described in [the advanced inventory roadmap](INVENTORY-ADVANCED-ROADMAP.md). That proposal is not part of the implemented feature claim.

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
| Browser acceptance | Saved counts and purchasing/role/mobile scenarios passed in real Chrome on the packaged candidate; wider manual camera/print/keyboard acceptance is not implied |
| Build and release | Production build passed; batch hardening deployed and verified; frontend rollout awaits Vercel team access |

## Responsive shell follow-up (2026-10-25)

The shared authenticated layout now uses a single toolbar. Mobile management navigation opens from its menu button rather than occupying a separate strip. Language/theme controls remain available in a native preferences popover. Header controls have consistent 44px touch targets, long context/name text truncates, and a branch picker uses its own full-width row on small screens. Notification panels stay within the phone viewport and support Escape dismissal/focus return with expanded-state accessibility metadata.

`e2e/responsive-shell.e2e.ts`: both Chrome scenarios passed against local development staging at `http://[::1]:3110` (2.6 minutes total). Manager checks cover 320/390/768/1024/1440/1920px, toolbar overlap/height, page overflow, touch targets, popover bounds, Escape, menu links, English/German switching and theme switching. Staff and brand-owner checks cover 320px, preferences, employee bottom navigation and owner branch-picker bounds. The focused workspace regression check also passed, including mobile-menu markup and closing on navigation.

The manager scenario was subsequently tightened to wait for loaded German purchasing data before its final screenshot and passed again (2.9 minutes; runner total 3.1 minutes). Its latest report replaces the previous report in the ignored local report directory. One intervening preflight attempt timed out while the dev login page recompiled; no additional UI failure was inferred from that startup timeout.

Screenshot review also exposed a real mobile usability gap: purchase-order actions were outside the visible table columns. At widths up to 600px, the order list now reflows into cards with reference/status, supplier, expected date and Open action visible; desktop retains the table. The focused card scenario passed at 320/390px, including no internal horizontal overflow and opening the saved order (1.5 minutes; runner total 1.8 minutes). The operations/preflight regression also passed after readiness was moved to the lightweight public offline page; workflow tests still load and test their real pages. The latest local report now contains this focused card scenario.

Presentation tests use valid local Supabase-authenticated sessions, not production accounts or a bypass of protected-page authentication. Browser password-form behavior remains a separate workflow concern. Initial runs were blocked by stopped Docker and a stale test-candidate login implementation; Docker/local Schnitzery staging were restarted and the candidate login files aligned with current source. The isolated dev candidate disables telemetry instrumentation and explicitly allows its IPv6 dev origin; those test-only settings are not production changes. This is browser/dev verification, not a fresh production build or deployment, and it does not establish exhaustive responsiveness of every page's content.

The previously packaged standalone candidate at port 3108 predates these shell edits. Use port 3110 to inspect this work while the isolated development server is running.

## Inventory entry points

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
- Source TypeScript passed. The full candidate build below covers this complete inventory release, rather than substituting the earlier count-session-only build.
- The complete isolated candidate `next build --webpack` passed: compile (10.3 minutes), TypeScript (7.9 minutes), all 76 generated pages and standalone tracing/packaging. Routes include `/inventory/counts` and `/inventory/purchasing`.
- Standalone candidate started successfully with explicit local-staging runtime settings. HTTP smoke checks passed: login 200, compiled CSS assets 200 with `text/css`, and unauthenticated inventory redirect. The first request warmed slowly; a subsequent direct login request completed in approximately 0.4 seconds. This is a local smoke observation, not a production performance guarantee.
- The test runner's missing locked Rolldown native package was restored from integrity-verified local npm cache. Vitest now has the same `@` source alias as Next and scans source tests rather than ignored staging copies. No package upgrade was introduced.

## Combined browser test

The isolated candidate uses local Supabase at port **55321** and listens on **http://[::1]:3108**. Use that IPv6 address for Node/Playwright: `schnitzery.localhost` can resolve to IPv4 while the server listens only on IPv6. It does not point at production. Synthetic accounts remain in `.audit-db/local-staging/test-accounts.passwords.txt`; do not include that ignored file, passwords or keys in a review bundle. The built candidate can be restarted locally with `node .audit-db/inventory-workspace/build-candidate.cjs --serve` while the local Supabase stack is running.

Browser tests: `e2e/inventory-workspace.e2e.ts`. Existing daily-flow and multi-branch tests use the new product editor and actual transfer receiving. Tests refuse remote hosts through `e2e/local.ts`. Set `E2E_BASE_URL` to the candidate URL before running `npm run e2e`.

Follow-up browser verification on 2026-10-24, against the packaged candidate:

- Saved-count progress/reload, unpublished-count assertion and cancellation passed in real Chrome (2.7 minutes).
- Saved order, supplier creation, approval/manual sending, two partial receipts, exact saved quantity/cost assertions, cross-branch manager denial, staff denial, brand-owner access and 390px German purchasing layout/no-page-overflow passed (4.5 minutes; runner total 5.2 minutes). A mobile screenshot was attached to the local report.
- Inspecting that first mobile screenshot showed it was captured during loading. The scenario now waits for the New order action to be enabled, and an independent loaded-data German mobile test passed in 27.3 seconds with the same overflow assertion and a fresh screenshot. The original full scenario was not rerun after adding that wait; its loaded mobile portion was verified separately.
- Initial attempts exposed ambiguous supplier/checkbox selectors and Next's separate route-announcement alert. Tests now use accessible roles and filter the application error. Local page loads also exceeded the initial 30-second deadline; actions/expectations are bounded at 60 seconds, with a ten-minute ceiling for this multi-role scenario. These local results are not production performance benchmarks.
- Preflight now bounds requests and rejects HTTP errors as well as connection failures; runnable regression assertions cover its healthy/unhealthy responses.
- All eight targeted regression suites passed again. Shared-dialog cancellation and zero-target grid regressions passed; the operations/preflight check passed after its final edit.
- A concurrent full-source TypeScript run was stopped to release local resources for Chrome; no fresh successful full typecheck/build is claimed for the later source edits. The previous full build remains the candidate baseline.

Traces/screenshots can contain synthetic credentials and belong only in the ignored local audit folder, not a shared review bundle. This run does not claim all inventory pages/dialogs have had exhaustive manual keyboard, camera or print testing.

Post-candidate source hardening: the shared dialog now always prevents native Escape dismissal before delegating to its discard confirmation; zero stock against a zero target is green in both count views; successful order commands open the order tab. Runnable checks cover dialog cancellation/busy behavior and the zero-target grid result. These source edits are newer than the previously packaged standalone candidate, so that older build is not evidence for these edits.

```powershell
$env:E2E_BASE_URL = "http://[::1]:3108"
npm run e2e
```

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

Release follow-up (2026-10-25): the unit suite passed **79 tests** and the fresh production build passed compilation, TypeScript and all 76 routes. The release CI sweep also exposed two obsolete fixtures (branch resolution and the former catalogue layout) and an untranslated new batch-validation message; these were corrected and their focused checks passed. The final regression sweep/build results are recorded when complete. Vercel project access still returns 403 for `venkatasudas-projects`; frontend deployment has not happened.

Production migration verification used the authenticated Supabase CLI against `vxwtmtlkwvwcdegtcjuz`. The initial history showed nine apparently pending versions, but a live application-schema backup proved that eight older migrations' objects already existed. Comparing against staging found 921 matching definitions, a count-function comment difference, an older staging audit-message encoding difference, and stricter production grants. Production's stricter grants and correct audit text were preserved. The eight already-applied history entries were reconciled, then only **20261025062639_inventory_batch_hardening.sql** was actually applied. All 28 history versions now match the isolated release manifest. Historical migration files fetched for that manifest remain private in `.audit-db`; no existing migration DDL was blindly replayed.

Batch hardening removes browser quantity/identity/expiry edits and deletes. Older clients retain only their guarded status-only active→used transition; the trigger stamps the actual actor and time. `use_batch_atomic` and `discard_batch_atomic` use a private checked transaction with active-account/branch authorization, locking, closure evidence and idempotent retries. Discard creates waste atomically. PGlite attack/rollback checks and real local PostgreSQL tests passed; local fixtures were rolled back. Live production checks verified column/function permissions, the enabled trigger, migration registration and denial without an authenticated actor. No business stock, wage or attendance records were edited for production testing.

`.vercelignore` now explicitly excludes local credentials, environment files, recovered schema backups, test artifacts and dependency/build directories. Release connection scripts containing temporary credentials are private local tooling and must not be shared.

Production already has the count-session and inventory-operations schema, and its history is now reconciled. **Do not reapply those CREATE statements to production.** Other environments must apply the migrations in version order. The current deployment blocker is Vercel team authorization; database hardening is already live and supports the older frontend's batch actions.

This release uses purchase-order receiving; the existing quick-delivery form remains for unplanned single-line entries. Automatic supplier emails, invoice attachments, multi-arrival transfer receipts, partial batch consumption, unit conversions and warehouse/location modelling are not included. They are not implied by the current buttons or statuses.
