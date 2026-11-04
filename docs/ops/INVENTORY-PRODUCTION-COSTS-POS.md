# Production costing, batch evidence and POS intake

## Release state

Work branch: `codex/production-cost-traceability`, built on the ingredient-price work in PR #83. This is local/review work, not a production deployment. Do not close the entire inventory audit based on this document.

## What changed

- Kitchen production accepts editable planned quantities separately from actual withdrawals. The example-plan button sets **one stock unit in the plan only**. It never fills actual consumption, prices or posts stock. Managers replace plans with their own numbers and confirm actual measurements before posting.
- Posting uses the existing atomic ingredient-consumption/finished-batch transaction. It now freezes the allocated ingredient unit cost and its evidence. A receipt-linked input uses that receipt's amount divided by accepted quantity. A produced input inherits the previous run's frozen ingredient allocation. Missing costs stay null. No labour, overhead or arbitrary example prices are added.
- Recipe reference prices are not treated as actual receipt costs. Receipt tax basis is not confirmed in the existing receiving schema; allocated amounts are labelled invoice-basis operational costs, not net COGS or profit. Later invoice corrections affect current purchased-batch value but do not silently rewrite posted production snapshots.
- Posted records cannot be edited. A manager may reverse a **mistaken entry only**, after confirming that actual cooking did not occur. The original run, ingredient actions, cost evidence, reason, actor and timestamp remain. One transaction restores inputs, closes the erroneous output and appends a stock-history correction. Retrying the same command is idempotent. Changed retries, wrong roles/branches and already-reversed runs are denied. Output already consumed, wasted, used by unreversed production, or affected by an ambiguous product transfer cannot be reversed. Actual food production cannot physically be undone.
- Count reconciliation excludes reversed erroneous output; this is a restatement of the mistaken production record, not a new receipt on the reversal day. Previously reviewed reconciliation figures must still pass the existing snapshot comparison.

## Where managers find it

**Inventory > Stock > Kitchen production:** draft, plan/actual input, post, review cost evidence and correct a mistaken posting.

**Inventory > Reports > Batch costs & traceability** (`/inventory/batch-report`): known tracked-stock subtotal, unpriced batches, per-batch source, upstream/downstream production lineage, use/waste actions, reversal notes and actual-versus-planned quantities. Original and closed lots can be selected. Evidence can be exported as `schnitzery-inventory-evidence-v1` JSON for review or a future accounting adapter. It is a management export, not a DATEV/Lexware posting file.

The stock subtotal covers registered remaining batches only. It is not a substitute for physical counts, a complete stock ledger or statutory valuation. Production reports use frozen costs; purchased stock uses its current corrected invoice cost. Mixed units are never added as quantities.

## Provider-neutral POS foundation

**Inventory > Reports > Till connections** (`/inventory/connections`) creates a disabled branch-bound connection, allows intake to be enabled/disabled, displays server-credential readiness and reviews the latest 50 import records.

The endpoint is `POST /api/integrations/pos`, deliberately excluded from session-login redirects. It authenticates with HMAC instead of browser cookies. It accepts only the normalized daily-total contract below. An enabled connection without a server signing key still cannot receive data. Secrets never appear in browser responses, Git or logs.

Server environment: `POS_INGEST_KEYS` is a JSON object mapping connection UUIDs to independent random signing secrets of at least 32 characters. Configure it only when a trusted provider adapter is ready. No keys are set by this change.

Headers:

- `x-pos-connection`: prepared connection UUID; branch comes from its stored configuration, never from the sender's payload.
- `x-pos-timestamp`: Unix seconds, no more than five minutes from server time.
- `x-pos-signature`: `sha256=` plus lowercase hex HMAC-SHA256 of `timestamp + "." + exact UTF-8 request body`, using that connection's secret.

Synthetic contract example (not real sales):

```json
{"format":"schnitzery-pos-daily-v1","external_id":"example-export-1","currency":"EUR","days":[{"date":"2026-01-01","gross_sales":123.45}]}
```

The adapter must supply complete daily **gross** EUR totals, including its own correct treatment of refunds/voids, instead of summing overlapping shift or payment exports. One import has 1–400 unique past/current dates, bounded nonnegative amounts and cent precision. Request size is limited to 1 MB while reading. Future dates, other currencies and malformed payloads fail validation. Provider-specific authentication, pagination, webhook verification, time-zone closing rules and amount mapping belong in the provider adapter when the actual system is chosen.

Signed intake stages an immutable payload; it does not publish sales. `(connection, external_id)` deduplicates identical retries and rejects changed content. A manager checks the branch/dates/gross totals and adds a review note before approving or rejecting. Approval writes all days atomically. A conflicting existing sales date aborts the entire approval; manual or another till's totals are never overwritten. An approved import is not an immutable accounting lock on the existing editable `daily_sales` table: later manual corrections remain possible through the portal, while the original imported payload stays unchanged.

The service-role-only staging RPC is unavailable to ordinary authenticated clients. Management configuration/review functions verify active account, role and branch. Newly exposed tables have RLS and authenticated read-only grants.

## Deliberately unresolved boundaries

- No real POS/accounting provider is connected; vendor API credentials and normalization still require that provider's documentation and acceptance tests.
- The contract covers daily revenue, not menu-item sales or automatic recipe depletion. There are no invented transactions or consumption records.
- Transfers currently lack verified lot links. The lineage page explicitly excludes them and POS sales; it does not claim end-to-end recall assurance across those gaps.
- Count-derived total usage/COGS completeness guards remain. Complete accounting valuation, confirmed net tax basis, sales-linked theoretical consumption, historical cost revaluation and full branch comparison are not established by a tracked-batch subtotal.
- Existing historical production has no frozen snapshots; missing history is not backfilled from today's prices.
- The report currently reads one branch's history. Large-history pagination/server-side graph traversal is the next scale boundary, not an additional service introduced pre-emptively.

## Verification

- `scripts/checks/receiving-batches.cjs` applies the real migrations and checks production cost snapshots, unchanged older costs after invoice correction, reversal/retry/used-output denial, role/branch restrictions, staged POS imports, duplicate/conflicting payloads, disabled connections and atomic approval conflicts.
- Unit tests cover batch valuation, transitive lineage and reversed links, planned quantity validation, POS contract validation, HMAC tampering and expired timestamps.
- `e2e/inventory-production.e2e.ts` retains the original production workflow with planned inputs, plus an independent phone lineage/mistaken-record-reversal test seeded through the real manager RPC. `e2e/pos-pipeline.e2e.ts` covers signed-out endpoint denial, management setup/review, sales publication, branch/staff restrictions and German phone layout. Fixtures are synthetic and local only.
- Valid provider-signed HTTP intake, production deployment, live-role workflows and external accounting/POS acceptance remain release checks. No full audit closure is claimed.

Local migrations: `20261104161047_production_costs_and_reversals.sql`, then `20261104161758_pos_import_pipeline.sql`. Apply after the manual-production migration and release frontend/database together. These migrations do not insert demonstration stock or sales into production.

Initial local validation on 4 November 2026: 134 unit tests, TypeScript, database regressions and local security advisors passed. POS browser review/branch/staff/German-phone acceptance passed. The combined production test reached the new report but exceeded its 60-second locator wait during the client-first initial load; original production/role/expiry assertions had passed before that point. Initial report/connection data now comes from the server, with branch-keyed client state, removing that extra request waterfall. Focused browser acceptance is rerun independently; see the PR for final results. This does not claim the complete live audit has passed.
