# Independent review: Releases C and D

Reviewed 2026-10-22. Implementation: `4bf1117`; working HEAD at completion: `1b4cafb` (handoff documentation added, relevant implementation unchanged). Scope: the handoff's reconciliation, valuation, business analytics, review records and affected exports. This is not certification of every portal workflow.

**Verdict: changes requested.** The implementation has useful separation between calculation, queries and UI, and existing role/branch tests pass. However, incomplete inputs can still produce apparently complete financial results. Resolve the P1 findings before relying on these figures for business decisions.

No application code or production data was changed during this review. AI remains deferred.

## Confirmed findings

### 1. P1 — Products without usable intervals disappear from completeness checks

Location: `src/lib/inventory/valuation.ts:20`, `src/lib/queries/inventory.ts:312`.

`valueUsage` determines completeness using only supplied reconciliation intervals. A product with one count (or no counts) generates no interval and therefore contributes neither a cost nor a missing-data reason. A shared span among the remaining products can then unlock a misleadingly complete cost-of-goods-used percentage.

Reproduced through the actual analytics query with Oil and Rice in the catalogue: Oil has two counts, Rice only one, and both have prices. The result is `usageComplete: true`, usage EUR 10 and `cogsPct: 10`. Rice's unknown usage is omitted.

Fix: compare interval coverage against the branch's applicable stock identities, including unit. Explicitly mark missing opening/closing counts or incompatible periods; suppress the percentage until coverage is complete. Reuse the existing `Figure` missing-reason mechanism.

### 2. P1 — Missing stock counts become a complete zero valuation

Location: `src/lib/inventory/valuation.ts:40`, `src/lib/queries/inventory.ts:317`.

Stock valuation only receives counts found inside the selected analytics window. It cannot distinguish an empty branch from stocked products lacking recent counts. With catalogue products and purchase records but no counts, the query returns stock value `0`, `complete: true`.

Fix: use the latest applicable count per stock identity with its date and explicit coverage/staleness. If counts are missing, show unknown/incomplete rather than zero. Keep analytics-period filtering separate from the stock-as-of-date lookup.

### 3. P1 — Different units on the same date are silently treated as recounts

Location: `src/lib/inventory/reconciliation.ts:44`.

The query groups category/product together to detect unit mismatches, but `byDay.set(c.date, c)` discards every earlier row for that day before checking units. Counts in kilograms and bags become one apparently clean interval instead of distinct identities or an uncertain result.

Repro: October 1 has 100 kg and 10 bags; October 3 has 80 kg and 8 bags. The calculator returns one clean interval using 2 bags; the 20 kg change disappears. This also affects valuation completeness.

Fix: resolve recounts within the full stock identity, including normalized unit, or explicitly reject mixed identities as uncertain before deduplication. Preserve the approved latest-recount behavior for actual recounts of the same identity.

### 4. P1 — An opening count during transit can double-count a receipt

Location: `src/lib/inventory/reconciliation.ts:55`.

The incoming-transfer guard checks only whether the closing count falls before booking-in. It misses an opening count taken during transit when receipt is booked before the closing count. The opening count may already include those goods, so adding the receipt again is unsafe.

Repro: transfer sent October 1, opening count 14 on October 2, receipt of 4 on October 4, closing count 10 on October 5. Current result is clean usage of 8 with no uncertainty reason. If the opening count already included the goods, usage was 4.

Fix: consider both count boundaries when checking transit ambiguity, using the existing conservative same-day treatment. Mark ambiguous intervals uncertain and withhold derived percentages.

### 5. P2 — Invalid intermediate counts are removed instead of surfacing a data-quality gap

Location: `src/lib/inventory/reconciliation.ts:46`.

Filtering invalid counts before building intervals bridges across an invalid record. Counts 10 on October 1, invalid on October 2, and 5 on October 3 produce an ordinary clean interval. A missing/invalid count is indistinguishable from no attempted count and its data-quality problem is hidden.

Fix: surface rejected count records and their effect on coverage. Do not silently present the surrounding interval as fully verified. Keep bad historical data visible even if current writes reject it.

### 6. P2 — Deleted transfers lose their surviving journal evidence

Location: `src/lib/queries/reconciliation.ts:50`.

Event lookup is restricted to IDs from current transfer rows. If a transfer is removed, its append-only stock events remain but reconciliation never consults them. In the fixture, a retained sent event for a deleted transfer is ignored and the result is labelled complete. This applies to historical/maintenance deletions; this review does not claim that the normal manager UI exposes deletion.

Fix: use retained journal evidence to reconstruct relevant movements or explicitly mark affected intervals uncertain. Do not derive audit completeness solely from surviving mutable source rows.

### 7. P2 — A review can appear current after the reviewed evidence changes

Locations: `src/app/(app)/inventory/Reconciliation.tsx:11`, `src/lib/queries/reconciliation.ts:78`.

`changedSince` compares only used, expected and closing. A change to status, reasons or movement composition with the same three totals does not invalidate the review. Reproduced a gain-to-unusual change and different delivered/received breakdown for which `changedSince` returns false. The flagged row can remain absent from the needs-review view.

The save path also recomputes figures without comparing them to the snapshot shown to the reviewer. Concurrent changes between viewing and saving can therefore attach their note to figures they never saw.

Fix: compare the full canonical reviewed evidence, and pass an expected snapshot/version when saving. Recheck it server-side and return a refresh-required conflict on change. Keep historical reviews immutable.

### 8. P2 — Direct authenticated inserts bypass server-side snapshot recomputation

Location: `supabase/migrations/20261021180000_stock_reconciliation_reviews.sql:22`.

The authenticated role can insert the `figures` JSON directly. RLS checks role, branch, actor and count ownership, but does not establish that figures correspond to those counts and movements. An authorized manager can bypass the server action and insert arbitrary permanent audit evidence within their own branch.

Confirmed in isolated PostgreSQL using the real migration: an authenticated manager inserted `{used:123456, opening:999999, status:"ok"}` against counts 10 and 2. Existing branch/staff denials still passed. This is an audit-integrity issue, not evidence of cross-branch access.

Fix: make snapshot creation a trusted database operation that computes/validates evidence, or remove direct client INSERT and expose a narrowly scoped authenticated server path. Preserve branch authorization and actor attribution; do not solve it with a broadly privileged client.

### 9. P2 — Future-dated records enter current-period actuals

Location: `src/lib/queries/branch-analytics.ts:126` (also inspect monthly-summary period queries in `src/lib/queries/labor.ts`).

Current-month query bounds extend to month-end while coverage excludes future days. Existing future-dated records can therefore increase current actual sales and spending without making coverage incomplete.

Reproduced with simulated today October 11: sales EUR 100 today plus EUR 1,000 on October 20 produce actual sales EUR 1,100; purchases EUR 30 plus future EUR 300 produce spend EUR 330, marked complete.

Fix: cap actuals at the current Berlin date consistently across sales, purchases and completed work. Keep future/planned figures separate. Write-time validation alone does not repair existing/imported records.

### 10. P2 — CSV export drops financial completeness information

Location: `src/app/(app)/summary/page.tsx:63`.

The screen warns about partial values, but CSV exports raw labour/spend totals without completeness or missing-input columns. An exported lower-bound cost becomes an apparently final amount. It also retains `Food cost %` for a purchase-spend ratio, contrary to the new UI terminology.

Fix: export value, completeness and missing-data reasons together, including employee-level missing wage information. Rename the ratio to purchase spend / sales. Confirmed by source inspection; this finding is not included in the eight runtime reproductions.

## Verification and evidence

- Existing suite: 101 tests across 13 files passed.
- Existing isolated PostgreSQL reconciliation checks passed, as did the reconciliation-query checks. These establish useful role/branch/immutability behavior but do not cover the failures above.
- Additional executable reproductions: `node scripts/audit/review-c-d.cjs`. It exercises actual calculation/query code using the existing isolated harnesses; eight assertions confirm the currently incorrect outcomes. A successful exit means the bugs reproduced, **not** that correctness passed. Convert the assertions to expected safe behavior when fixing them.
- The direct-insert finding was independently reproduced in isolated PGlite with the real migration. No real accounts or records were used.
- Additional existing checks passed: `business.cjs`, `business-ui.cjs`, `inventory-data.cjs`, `workspace-ux.cjs`; `tsc --noEmit` completed successfully.
- No fresh production deployment inspection, full browser matrix, CSS overflow certification or complete offline/role-workflow acceptance was performed in this review. Those remain separate acceptance work, not passing claims.

## Improvement order

1. Fix stock identity, count coverage and transit boundaries together; make the new reproductions regression checks.
2. Make review freshness and creation trustworthy at the database/server boundary.
3. Preserve historical journal evidence and consistently bound actuals by Berlin today.
4. Carry completeness into exports; then run manager/HQ/employee browser checks at desktop and 390px, including German text, keyboard interaction, errors and stale-data recovery.
5. Measure the full-history purchase lookup on representative data before optimizing it. The existing 100k ceiling is a limit to test, not proof of acceptable production latency. Avoid adding new architecture until query measurements justify it.

These are targeted corrections to the current design. A new agent framework, UI rewrite or additional infrastructure is not required to resolve them.
