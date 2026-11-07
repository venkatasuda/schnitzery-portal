# Inventory feature placement

Updated 6 November 2026. This is a placement correction, not a new inventory accounting or POS-provider implementation. No database migration is required.

## Where tasks live

| Area | Tasks |
| --- | --- |
| Stock | Saved stocktakes, quick count, product catalogue (including units/packs/reorder configuration), physical batches, expiry and labels |
| Purchasing | Orders and receiving; suppliers; returns and supplier credits; reorder planning; delivery history; ingredient reference price versions and stock alerts |
| Kitchen | Recipes/costing, preparation targets, actual production and recipe-based sales stock consumption |
| Movements | Stock movement history, branch transfers and waste recording |
| Inventory reports | Stock insights, purchasing/usage analysis, count reconciliation, valuation closes and batch traceability |
| Business reports | Sales imports and daily-sales approval; sales/labour reporting remains in the business workspace |
| Settings / Integrations | Till connection creation, enabled state and signing-key/provider readiness |

## Concrete corrections

- Split the former combined inventory connection/review screen into `/settings/integrations` (setup) and `/sales/imports` (intake/review). `/inventory/connections` redirects to Settings for saved links.
- Moved normalized sales export entry out of Kitchen. It is optional, advanced input on the sales-import screen; recipe mapping and reviewed stock posting remain in Kitchen.
- Settings links to integration setup. Business reporting and the sales/labour report link to sales-import review. The global sidebar classifies each new route under its actual workspace.
- Removed the second Purchasing tab row. Orders, suppliers and returns are addressable through one shared navigation, with distinct headings and order actions shown only in Orders. Query changes/browser Back restore the intended Purchasing subview/order.
- Receiving stays in Purchasing. Delivery history uses its full content width and links to receiving, rather than presenting a second receiving panel beside the same history.
- Daily stock-work shortcuts contain receiving/counting/expiry/reorder work; reporting shortcuts no longer compete there.
- Movements opens its actual history. The older workflow hub remains available to bookmarks.
- The printable reorder helper remains available as an optional worksheet, labelled separately from saved purchase-order drafts.

## Cross-links that are intentional

A recipe can link to reference ingredient prices; a stock report can link to its source batch/production evidence; sales approval can link to recipe stock consumption. These are related workflow steps, not duplicate forms or extra copies of features. Product master data still owns pack conversions and reorder settings. Operational stock reports remain with inventory; general sales and labour reporting does not move into it.

## Acceptance

Eight focused rendering/navigation tests passed, including the separated forms, Purchasing selection and sidebar classification. TypeScript passed on the final changes. All 23 CI security/UI regression scripts passed on the final source.

Browser acceptance remains unverified for this placement change: local preflight could not reach the portal while Next remained compiling instrumentation. The dev server was stopped. Updated local-only browser tests cover the moved import/approval workflow, consumption and Purchasing reload/Back navigation; run them with a healthy staging portal. Earlier browser passes belong to the older arrangement and are not evidence for this one. Production data, permissions and accounting semantics are unchanged.

## Consolidation and control layout — 7 November 2026

- Stock navigation is reduced to Stocktakes, Catalogue and Batches/expiry. Count-one-item remains available from the Stocktakes header and existing filtered-count drilldowns. Product QR labels are opened from Catalogue, with a return link back to Catalogue. No counting or printing capability was removed.
- Overview starts the saved stocktake workflow. The quick-count screen keeps its scan tool and per-row recording, rather than presenting another competing stocktake action.
- Sales consumption opens with the daily stock-review task. Versioned mapping setup/history are grouped in a Manage recipe mappings disclosure. Missing mappings remain visible and block posting as before.
- Shared buttons and single-line fields use the same minimum control height and typography. Header actions, filter bars, checkboxes and modal footers align and wrap consistently; mobile action groups share the available width.
- Small native progress bars explain catalogue coverage (counted/fresh/priced) and overview count completion. Empty denominators have no bar. Quantities in different units and uncertain costs remain in tables; no decorative aggregate chart was added.
- The label page uses the common header and a responsive grid. Read/generation failures show an error and Retry; incomplete QR generation cannot silently enable printing.
- Batch help now describes explicitly posted lot-linked transfers/production/consumption accurately; unposted plans and sales do not move stock.

Browser visual acceptance is deliberately deferred for this pass, as requested. TypeScript, nine focused tests and all 25 security/UI/design/accessibility regression scripts passed. Do not treat screenshots from the earlier layout as acceptance of the consolidated layout.
