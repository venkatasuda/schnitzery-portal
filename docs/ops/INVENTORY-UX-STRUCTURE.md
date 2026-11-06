# Inventory UX correction — 6 November 2026

The earlier workflow acceptance did not establish interface usability. Live inspection of Overview, Stock, Reports and Valuation confirmed misplaced tools, inconsistent subnavigation, excessive introductory text and an unhelpful empty valuation form.

## Implemented in this branch

- One shared navigation across inventory routes, expiry, labels, alerts, waste and transfers.
- Six areas: Overview, Stock, Purchasing, Kitchen, Movements and Reports.
- Stock: saved stocktakes, quick count, catalogue, batches/expiry and labels. Purchasing: orders, reorder planning, deliveries, ingredient reference prices and alerts. Kitchen: production, prep planning, recipes, sales consumption and till-import setup. Reports contains analysis, reconciliation, valuation and traceability.
- Explicit parent return links with arrows; no dependency on browser history. Existing unsaved-edit checks also protect these links.
- Persistent sibling links and current-page indication on detail screens. Removed the duplicate main-page tab definition.
- Task-specific headings, shorter count guidance and on-demand explanations on five detailed screens. The consumption double-deduction caution remains visible.
- Empty unconfirmed valuation has a receiving action instead of a zero-value claim, empty table and unusable cost/close forms. A genuinely reconciled zero close remains supported.
- Mobile area navigation uses two rows; task links scroll horizontally instead of wrapping into a wall of links.

## Verification and limits

Focused navigation tests and the workspace regression check passed, including the empty-valuation case. TypeScript passed after the changes. No SQL or production changes are part of this branch.

These changes address shared structure. They do not certify every dialog, supplier-return flow, populated table, small-screen layout, keyboard interaction or all role combinations. A new visual browser pass on the changed build is still required; previous browser passes were on the earlier interface.
