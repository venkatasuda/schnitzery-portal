# Inventory UX review — 2026-10-23

## Verdict and evidence limits

The inventory module has useful functionality and increasingly consistent components, but its task organisation is not yet ready for an enterprise operations product. Its main weakness is the absence of clear, durable workflows for counting, receiving and ordering. More colours, cards or tabs will not solve that.

This review covers the **current working tree**, including uncommitted changes, at HEAD `a49b533`. It covers Inventory, Count, Catalog, Deliveries, Reorder, purchase-order drafts, stock alerts, waste, expiry, transfers, history, reconciliation, scanning and labels. Findings below come from current source. The available browser tabs point to stopped preview servers; no fresh signed-in visual acceptance was performed. Earlier screenshots and test counts are not evidence for today's working tree. No application code or business records were changed. This is not a full security/backend audit or a competitor market study.

My earlier pass improved consistency and some interactions, including keyboard submission and retry. It did not finish the inventory product design. The newer shared components, translated labels and existing uncertainty indicators are useful foundations to retain.

## Release blockers: trust before styling

### 1. Missing delivery prices can become zero-priced order lines

**High severity, source-confirmed.** `src/lib/queries/inventory.ts:623` builds a price using `Number(p.cost) / Number(p.qty)`. A missing/null cost becomes zero. The same path does not reuse the coverage-aware pricing rules used elsewhere. At the end of the function, `hasPrices` means **any** item has a price, rather than all selected items having valid prices.

`src/app/(app)/inventory/order/page.tsx:45` sums missing line costs as zero; lines 117–147 display ordinary subtotals and a grand total when `hasPrices` is true. Example: a known EUR 20 line and an unpriced line can produce a plain `Total EUR 20`. The user cannot safely infer the order's actual value.

**Required change:** preserve unknown prices, reuse the existing validated pricing/coverage helper, distinguish genuine free items from missing prices, and show known amount + missing-price count in screen, copy, email and print outputs. Block a final/confirmed total until the selected lines are complete. Do not turn this into another independent pricing implementation.

### 2. A failed order-draft load can look like healthy stock

**High severity, source-confirmed.** `src/app/(app)/inventory/order/page.tsx:22` handles successful results but does not set an error for a resolved `{ok:false}` response. It then stops loading. An initial failure leaves an empty group list, which reaches the "nothing to order / stock is healthy" empty state; a later failure can leave old groups under new coverage settings. The catch path uses only a toast.

**Required change:** persistent loading/error/empty/stale states with a retry action. Clear or explicitly mark stale results when the coverage setting changes. A healthy-stock message requires a successful result with sufficient source coverage.

### 3. "Current" stock is really today's physical count

**High-priority clarity issue, source-confirmed.** `getCounts()` in `src/lib/queries/inventory.ts:116` selects a specific count date, defaulting to today. The table in `inventory/page.tsx:358` labels the value "Current". A subsequent delivery or transfer is not, by itself, a new physical count. This encourages the user to read a snapshot as a live balance.

**Required change:** label the figure "Last physical count" with its timestamp, or explicitly label this as "Today's count" within a count worksheet. Only show computed on-hand stock after implementing and verifying the relevant ledger calculation. Never infer zero from an uncounted product.

## Structural findings and exact improvements

| Priority | Current evidence | Why it causes friction | Required direction |
| --- | --- | --- | --- |
| High | `inventory/page.tsx:252`: seven tab choices mix work, analysis, evidence and product setup. Waste/expiry/transfers are in a separate menu. | Users must learn where the implementation put a feature rather than follow their task. Common kitchen actions are relatively hidden. | Use five stable areas: Overview, Stock, Purchasing, Movements, Reports. Put product administration under Stock with role-appropriate actions. Give urgent work direct links from Overview. |
| High | Main inventory header has no explicit branch/date context; `layout.tsx:55` shows section, role and user. Reconciliation alone has a branch picker. | A manager/HQ user has weak confirmation of the branch affected by a stock action. | Show active branch persistently on every stock workflow and include branch + effective date in confirmations. Keep branch changes within existing server authorization. This finding is not evidence of a cross-branch permission bypass. |
| High | `inventory/page.tsx:30`: tab, search, status and category live only in component state. | Refresh, bookmarking and returning from a linked page lose working context. | Persist shareable view/filter state in the URL. Keep unsaved edits separately; restore them or warn before leaving. Do not put sensitive draft data in URLs. |
| High | Count rows save individually (`inventory/page.tsx:380`); there is no count-session entity in this UI. | For a large count there is no clear draft, progress, completion, review or handover boundary. | Introduce a count session with scope, progress, per-line saved state, missing entries and review/finish steps. Durable sessions require backend support; a decorative progress bar is insufficient. |
| High | Catalog reuses today's count/target/status table and substitutes Remove for Count (`inventory/page.tsx:272,380`). Add form has product/category/target/unit; no corresponding edit workflow is presented. | Master-data maintenance is mixed with stock-taking, and removal is more prominent than useful maintenance. | Use a product list + product detail editor for units, category, par/reorder settings and active state. Keep archive in the row menu with clear consequences. Protect historical identity when units/names change. |
| High | Deliveries is a one-product form beside a recent list (`inventory/page.tsx:403`). | A real receipt containing many products requires repetitive independent entries with weak document context. | Use a receiving draft with supplier, document/date, multiple item lines, quantities, explicit line-cost meaning and a review/post step. Add invoice references and attachments when the receiving workflow needs them. |
| High | Reorder and `/inventory/order` each load forecast-derived suggestions; the order page imports only a draft query and keeps edits in local state. | Users can mistake a printable suggestion for a saved, traceable purchase order, and edits have no durable handoff. | Name the current feature "Order draft". When durable ordering is required, add reference, supplier, saved lines and lifecycle states: draft, approved, sent, partially received, closed/cancelled. Do not display a status without a server record. |
| Medium | Low-stock links, reorder forecasts, shortage exports, order-list copy and the stock-alert page overlap. | There are multiple starting points with subtly different decision rules and output. | Make Reorder the purchasing work queue. Keep stock alerts as saved exceptions/notification settings and threshold configuration; reuse a consistent shortage definition and drill-down. |
| Medium | `inventory/page.tsx:98–100,447–523`: period-filtered analytics sits beside a six-month chart and a fixed 30-day variance request. The six-month chart is already labelled. | A global-looking period selector can suggest a wider scope than it actually controls. | Show explicit scope on every fixed-window panel, especially variance, or make the chosen period govern comparable panels. Preserve the six-month label; do not misreport it as unlabelled. |
| Medium | Analytics includes spend, depletion, stock value, trends, category breakdowns and rankings in one long surface. | Decision-making competes with explanatory charts and lower-value rankings. | Lead with a small set of reliable figures + data coverage, then exceptions/actions. Put supporting trends and rankings under clear report sections. Each exception should link to evidence and a corrective workflow. |
| Medium | Reconciliation has ten table columns plus reason lists and an inline review editor (`inventory/Reconciliation.tsx:75`). | Dense audit arithmetic and editing compete inside a row; this is especially difficult on phones. | Use an exception queue with compact columns. Open a detail panel containing the count interval, arithmetic, movements, uncertainty reasons, evidence links and review history. A review must remain distinct from a stock adjustment. |
| Medium | History exposes actor UUIDs, raw transfer status strings and technical source operations (`inventory/StockHistory.tsx:57–69`); filters are mainly source type. | Ordinary managers have to interpret database events. | Show human event summaries and authorized actor names, product/unit, branch, effective date and recorded time. Add product/date/type filters and reference links. Keep IDs and before/after evidence in expandable technical details. Translate status names. |
| Medium | Waste uses a reporting form, recent entries and a delete action (`waste/page.tsx:57,159–171`). | The correction workflow is less clear than the original logging workflow. | Keep fast logging. For mistakes, expose a deliberate void/correction reason and a reference to the original entry. Preserve journal evidence. Confirm actual backend effects before adding an Undo promise. |
| Medium | Expiry's Used/Discard actions accept a batch ID, not a partial quantity (`expiry/page.tsx:53–63`). | Partly used stock cannot be described accurately in this interaction. | Support partial use/discard with remaining quantity and explicit stock/waste consequences. Preserve existing urgency sorting. Validate batch and movement accounting before making the UI claim stock has been changed. |
| Medium | Transfers has request/fulfil tabs and status-specific actions (`transfers/page.tsx:81–168`). | The status model exists, but a complete transfer's evidence is fragmented across queues. | Retain the working states. Add a transfer detail view showing source/destination, requested/sent/received quantities, actors and times. Add discrepancy/partial receipt handling only with matching backend transitions. |
| Medium | Scanner is a fixed div overlay with legacy colours rather than the shared accessible dialog (`inventory/ScanToCount.tsx:63`). | No dialog semantics/focus containment are supplied by this markup; it follows a different interaction model from grid counting. | Use the existing dialog foundation or a deliberately accessible full-screen scanner. Provide Escape/focus return, camera permission guidance, manual product entry and clear save/retry state. A dark camera surface itself is reasonable. |
| Medium | Scanning and ordinary count entry have separate save paths; scanner `save()` awaits without catch/finally (`ScanToCount.tsx:53`). | A rejected request can leave scanning stuck in a busy state despite ordinary count retry being improved. | Share count validation/error semantics across entry methods. Keep the entered quantity after failure and reliably release busy state. |
| Medium | Count worksheet renders all matching products, repeats a Save button, and has no visible sort interaction. | The workflow may become cumbersome for realistic catalogues. | Provide category/location scope, predictable sorting, a count-progress summary and keyboard movement. Measure with 200 representative products before adding pagination/virtualisation; do not add a new table library by default. |
| Lower | Labels is a separate supporting screen. | Label preparation can interrupt the stock task when selection context is lost. | Open label generation from selected stock items or product details; preserve selection and verify actual printed barcode readability. Avoid another top-level destination. |

## Proposed information architecture

Keep the existing portal. These are task views, not a recommendation for a second application, a new UI framework or duplicate business logic.

| Area | Views / tasks | Primary outcome |
| --- | --- | --- |
| Overview | Shortages, due expiry, unfinished counts, transfer issues, review exceptions | Decide what needs attention now |
| Stock | Stock list, product detail, count sessions, batches/expiry, contextual labels | Know what was counted and complete stock work |
| Purchasing | Reorder queue, saved order drafts/orders, receiving | Turn a shortage into a verified receipt |
| Movements | Transfers, waste, authorized adjustments, searchable ledger | Explain a quantity change |
| Reports | Cost/depletion, coverage, variance review, exports | Understand results and inspect evidence |

Start with URL-addressable views and clear labels. Do not build all future workflow entities at once. Saved sessions/orders need explicit schemas, permissions, immutable audit evidence and conflict handling before the UI promises durability.

## Stock workspace layout

1. **Header:** Inventory / Stock; named active branch; one primary task action. Scan is a supporting action unless observed usage makes scanning the dominant task.
2. **Work indicators:** relevant shortage, expiry, count and review queues. Each indicator filters or opens actual work; avoid duplicating the general dashboard's decorative metrics.
3. **One filter bar:** search, category/location if actually modelled, status and clear filters. Show scope and result count.
4. **Operational table:** product + unit, last physical count/date, applicable target/reorder setting, explicit status and contextual actions. Clearly distinguish unknown, stale, zero, insufficient data and actual shortage.
5. **Details:** product or issue panel with history and evidence. Preserve list filters/scroll on return.
6. **Count mode:** separate the worksheet from browsing. Show draft/saved/error states per line and completion coverage. Finish requires explaining omissions, not silently treating them as zero.

## Visual system direction

- Keep the existing light white/slate/teal palette. Teal = primary action/selection; amber = warning; red = destructive/error; green = confirmed healthy/success. Avoid assigning semantic success to an incomplete financial estimate.
- One body typeface; roughly 14px operational text, 12–13px secondary labels and 24–28px page headings. Numeric columns use tabular figures and right alignment. Use localized quantities, currency precision and explicit units.
- Use an 8px spacing rhythm, 16–24px panel padding, consistent 8–12px radii and restrained borders. Use available desktop width with deliberate gutters. Reading text and forms can retain narrower widths.
- Put lists in tables on desktop; use task-focused cards on phones. Do not convert every desktop row into a large decorative card. Choose density by task and maintain comfortable touch controls on mobile.
- One primary button per task section. Secondary actions are quieter; archive, void and removal belong in deliberate contextual actions. Keep scanner and manual-entry behaviour consistent.
- Give skeletons, genuine empty states, no matches, denied access, partial results, stale results and failed loads distinct presentations. Show actionable field errors near the inputs and persistent errors for failed workflows.
- Use existing shared components. Apply changes at the component/task boundary rather than adding another broad CSS override layer.

## Definition of done

These are proposed acceptance tasks, not completed checks:

| Scenario | Required observable result |
| --- | --- |
| Manager counts a realistic product category, leaves and returns | Scope, saved progress and unsaved-state handling remain understandable; no silent loss |
| A selected order contains known and unknown prices | No final-looking total; screen/copy/email/print agree on completeness |
| Forecast/order request fails | Persistent error + retry; no healthy-stock claim and no silently stale coverage |
| HQ switches branches | Branch is visible before every write; permissions remain enforced server-side |
| Receipt contains several lines, including a discrepancy | Draft/review/post outcome is explicit; failed posting does not look successful |
| Transfer is sent and only partly received | The UI reflects a supported backend state and preserves evidence; otherwise this scenario is explicitly unsupported |
| Batch is partly consumed | Remaining quantity and stock/waste effects are explicit |
| A reviewed interval changes later | Old review remains historical; changed evidence is visibly unreviewed |
| Keyboard-only manager | Filters, table actions, count inputs and dialogs are operable with visible focus and sensible focus return |
| 390/768/1280/1920px and German text | No hidden essential actions, clipped quantities or unintelligible horizontal audit editing |
| Disconnection during count/scanner/receipt save | Entered data survives, busy state ends, retry does not silently duplicate a write |

## Delivery order

1. **Trust patch:** fix order prices/totals and false healthy states; clarify count timestamps and active branch. Add focused regression checks for these exact failures.
2. **Task navigation:** introduce the five-area hierarchy and URL/filter restoration. Preserve routes or redirect deliberately; avoid a big-bang rewrite.
3. **Counting + product detail:** establish durable count workflow and proper catalogue editing. This is the core operational interaction to prove first.
4. **Purchasing + receiving:** saved drafts/orders, review, multi-line receipt and discrepancy handling where required by actual operations.
5. **Movement evidence + review:** usable transfer details, waste corrections, batch handling, ledger and reconciliation.
6. **Reports + final polish:** scope/coverage clarity, drill-through, responsive density, localization, accessibility and real-device print/scanner acceptance.

Competition with established enterprise products requires dependable quantities, useful workflows, adoption and recoverability as well as visual consistency. This review does not justify adding every ERP feature or replacing Next.js/Supabase. Prove the frequent restaurant tasks before expanding scope.

## Reference patterns

- [SAP: list report and object page](https://help.sap.com/docs/SAPUI5/b2f662dd9d7a4ec680056733050b4d34/c0eec49db81a441e878f528c8f3d28de.html): separate filterable work lists from an object's details and editing.
- [SAP Fiori elements guidance](https://experience.sap.com/fiori-design-web/explore_category/elements/): consistent edit/message handling and restoration of view state across navigation.
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): visible status, recognizable concepts, consistency and recovery. These are evaluation principles, not proof that the current portal passes them.
