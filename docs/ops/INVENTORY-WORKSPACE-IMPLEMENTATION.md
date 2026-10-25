# Inventory workspace — first implementation

Started: 2026-10-23. Verification updated: 2026-10-24. Branch at implementation start: `codex/inventory-workspace`.

Implements the first trust/navigation slice from [the inventory critique](INVENTORY-UX-CRITIQUE-2026-10-23.md). Changes are local; no deployment, migration, production-data write or supplier email was performed.

## Delivered

- Five stable areas: Overview, Stock, Purchasing, Movements and Reports. Shared navigation appears on the existing waste, transfer, expiry, label, stock-alert and order-draft pages. No second application or new UI dependency.
- Inventory opens on an overview of actual **today's physical counts**: coverage, missing counts and counted-below-target items. Links open the relevant worksheet filters or task. No invented expiry/transfer counts or live-stock claim.
- The active branch and Berlin count date are shown. A failed branch-context lookup prevents the workspace from presenting a verified write context.
- Operational tasks and report/catalogue tabs are separated. Count quantities are labelled as today's physical counts rather than live on-hand balances.
- Inventory view/search/category/status survive refresh and are addressable through URL parameters; view changes participate in browser history. This does not make count entries durable.
- Order draft explicitly describes its unsaved, planning-only status. It shows persistent load errors with retry, clears old results on regeneration and ignores stale responses. A successful empty response no longer asserts healthy stock.
- Draft pricing reuses `latestPrice` from the existing analytics coverage rules, preserves unknown versus explicit zero prices, excludes future delivery prices and keeps fractional unit-price precision until line totals are calculated. The source price date is available on each priced line.
- Screen, copied text, email body and print output share the same summary rules: known amount, missing-price count and incomplete indication. Invalid quantities prevent export. Draft edits trigger warnings on coverage changes, the draft's back/area navigation and full-page unload.
- Shared order money helpers and targeted checks are wired into existing CI. No additional framework or package was introduced.
- Count-coverage drill-down clears unrelated search/category filters so missing items cannot disappear behind an old filter. Null, blank, negative and non-finite legacy count values remain uncounted. The displayed count date follows the count response.

## Explicitly remaining

1. Saved count sessions are now implemented in a second local slice: [workflow, integrity rules and verification](INVENTORY-COUNT-SESSIONS.md). Production rollout and full signed-in browser acceptance remain pending. Today's overview coverage still represents published counts, not unfinished drafts.
2. Product editor and saved purchasing/receiving are now implemented in the next local slice; see [combined implementation and acceptance](INVENTORY-OPERATIONS-IMPLEMENTATION.md).
3. Transfer discrepancies, waste corrections, reconciliation details and ledger filters are also implemented in that slice. They still require joint signed-in browser acceptance and rollout.
4. Partial batch use/discard, unit conversions and other explicitly deferred capabilities are listed in that handoff; they are not represented as complete.
5. Role-specific signed-in browser acceptance, actual scanner/print tests, draft data-loss checks across every navigation path, and device/localisation coverage.

## Verification

Passed on 2026-10-24:

- `scripts/checks/order-draft.cjs`: actual query/component checks for missing/free/future/fractional prices, invalid quantities, persistent errors, stale responses, overview coverage, URL filtering, malformed counts and count drill-down.
- `scripts/checks/inventory-data.cjs`: stock identity, deterministic counts, forecasts, stale data and invalid writes.
- `scripts/checks/workspace-ux.cjs`: workspace errors, search, dialogs, labour coverage and role/input boundaries.
- `scripts/checks/count-sessions.cjs` and the isolated staging SQL assertion suite: saved-session boundaries and atomic database behavior (see linked count-session handoff).

The targeted checks used an isolated runtime restored from integrity-verified npm cache archives. They do not constitute signed-in browser acceptance. Browser automation could not attach its preview tab on 2026-10-24; no new desktop/mobile visual acceptance is claimed. The full `next build --webpack` subsequently passed with exit code 0, including TypeScript, all 75 generated pages and standalone tracing/packaging; the route output includes `/inventory/counts`. The isolated staging database security advisor reported no issues. `git diff --check` found no whitespace errors.

Dependency recovery: this workspace began with incomplete `node_modules`. Two `npm ci --ignore-scripts` attempts failed with Windows `ENOTEMPTY` errors. Next.js documentation is now available locally and its native history navigation guide was checked. No dependency upgrade was introduced by this inventory pass.
