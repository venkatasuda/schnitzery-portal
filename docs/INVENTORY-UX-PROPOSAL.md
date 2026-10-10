# Inventory UX proposal

> Superseded scope after user clarification: improve the existing Schnitzery portal in place. The separate Lovable prototype and proposed new workspace structure are not the implementation direction. Preserve existing role-aware hubs, bottom navigation, dark-first theme, bilingual UI, per-branch data, and current product scope. Read PRD.md, DESIGN.md, ARCHITECTURE.md, RULES.md, ROADMAP.md and PROJECT-MEMORY.md before deciding changes. Findings below remain candidates to verify; they are not permission to replace the app or add deferred features.

Status: proposed, 2026-10-10. Based on the local inventory, order, stock-alerts pages and inventory queries. No production implementation changes. Visual appearance in the current live app has not been verified.

## Findings

| Finding | Consequence | Change |
| --- | --- | --- |
| Four shortcut pills plus four state-only tabs | Competing navigation; refresh/back cannot preserve the selected workspace | One route-backed workspace navigation |
| Default count screen includes an unbounded shortage list, exports, scanning, labels, catalog creation and counting | Routine counting starts below unrelated tasks | Overview for attention; dedicated count flow |
| Inventory has a 720px maximum width; the shared .screen-wrap also caps at 820px | Repeated cards and long scrolling instead of comparable columns | Scoped layout change for inventory; aligned stock table on desktop, cards on mobile |
| Product removal beside count save | Catalog changes compete with daily operations | Move add/archive to permission-aware catalog management |
| Category-only product browsing | Finding an item requires knowing its category | Search all categories, then combine category/status filters |
| Hardcoded dark colors and small muted labels | Theme inconsistency; accessibility needs verification | Existing theme tokens, readable labels, keyboard and touch support |
| Label link targets /inventory/labels; existing route is /labels | Counting shortcut points to an absent local route | Reuse /labels |
| Reports period updates main analytics but variance stays at 30 days | Related report panels show different periods | Shared period controls, explicitly separate six-month trend |
| Purchase spend / sales is labeled food cost | Metric implies consumption-based costing it does not calculate | Label Purchases / sales and explain definition |
| Empty low-stock result can display all-at-target without proving count coverage or successful alert retrieval | Unknown state can appear healthy | Separate loading, failed, not-counted, stale and healthy states |
| Order estimate treats missing price contributions as zero and hasPrices means any price exists | Partial total can look complete | Missing-price count and partial-estimate label |

## Workspace

- Overview: branch, freshness, attention summary, latest activity; Start stock count primary and Record delivery secondary.
- Stock: search, category and text-status filters, last counted quantity/unit/date, target, details; Count is a focused task.
- Orders: existing editable supplier-grouped draft, forecast assumptions, missing-price warnings; distinguish draft/export from actual supplier submission.
- Activity: counts, receipts, waste, transfers and expiry, with focused subviews. Reuse existing routes and business services.
- Reports: explicit date range, purchase spend, estimated consumption value, recorded waste where available, Purchases / sales and evidence/coverage.
- Manage: catalog, thresholds and labels, gated by existing permissions.

## Main interactions

Count: select scope -> enter or scan an item -> enter nonnegative quantity with unit -> save -> next item. Show progress and saved state; protect unsaved edits when leaving. Do not invent a batch/session backend if individual saves cover the first version.

Delivery: open a labeled form from a relevant view -> select product -> quantity/cost/date/supplier -> validate -> save -> update history and affected summaries. Surface retryable failures without losing input.

Order: review suggestions -> adjust quantities -> resolve unknown price/supplier -> copy/export draft. The existing mailto opens the user's mail client; it does not establish sending, approval, supplier acknowledgement or delivery status.

Details: open an item drawer with dated counts and available receipt history. Expose other movement types only when backed by real records; do not imply the current counts are a live stock ledger.

## Layout and accessibility

Use the existing maroon/gold identity and light/dark tokens. Keep gold for primary actions, red for exceptions and a consistent icon set. Default task views should contain one main action, clear headings and restrained summaries.

Desktop: content around 1200–1280px where the app shell permits it, comparable stock columns and a secondary detail panel. Phone: readable item cards, full-screen counting, minimum 44px tap targets, decimal keypad and no fixed three-column operational grid. Retain the app's global navigation and avoid duplicate bottom bars.

Use associated input labels, visible focus, keyboard navigation, text statuses alongside colors, accessible dialogs with focus return and Escape, translated EN/DE labels, and locale-aware dates/currency. Verify contrast and 390px layout on the rendered result.

## Implementation sequence

1. Reorganize current capabilities: workspace navigation, focused counting, search/filtering, secondary catalog actions, direct Orders entry and correct labels link.
2. Clarify data: error/unknown/stale states, shared report periods, honest financial labels and partial estimates.
3. Add attention overview using existing data; include AI suggestions as secondary, clearly identified recommendations only when grounded.

Before editing Next.js routes, read the applicable bundled guides in node_modules/next/dist/docs as required by AGENTS.md. Preserve current uncommitted work.

## Review checklist

- Find an item without knowing its category and count it without navigating past a shopping list.
- Zero quantity is valid; negative and invalid quantities are rejected by trusted business logic.
- Search/filter empty results have reset controls.
- Failed reads never show all-stock-healthy or indefinite loading.
- No accidental catalog deletion in the counting flow.
- Mixed known/unknown order prices produce a clearly partial estimate.
- Back/refresh preserve the selected workspace and relevant filters.
- Keyboard and phone users complete count and delivery flows.
- Both languages and themes remain legible.

## Lovable proposal

A separate interactive prototype uses fictional data and is not connected to the portal or its database.

Editor: https://lovable.dev/projects/cbaa8daf-a954-4965-96ec-402138114f3c

Preview: https://id-preview--cbaa8daf-a954-4965-96ec-402138114f3c.lovable.app

Prototype build and interaction verification must complete before treating it as a reviewed implementation.
