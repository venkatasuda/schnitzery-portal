# Phase 1 staging findings — 7 November 2026

Local staging, manager A, English + German, desktop + 375 px. Writes only on staging
(receipt `QA-CLAUDE-001`, one use, one waste, one published count).

## Passed
- Direct delivery receipt with two expiry batches; batches, lot and receipt link correct on Batches & expiry.
- Batch total mismatch refused by the server; duplicate delivery reference refused ("Reference already recorded").
- Unsaved-edit guard on the receipt dialog ("Discard this unsaved delivery?"); cancel keeps data.
- Record use (3 → 2 kg) and record waste (2 → 1.5 kg, posted to waste log); over-use blocked.
- Saved stocktake survives reload, publishes with confirmation, status Completed.
- Insights stock estimate correct (3.5 kg × €6 = €21.00).
- German text complete and no page overflow at 375 px on purchasing, expiry, counts, valuation.
- All 19 inventory routes load for a manager without errors.

## To fix in Phase 2 (priority order)
1. **Valuation close can be blocked forever (Codex).** `inventory_valuation_preview` requires a count for every
   active batch identity, including archived catalogue products; the count session only lists active products
   (`20261105163337` lines 50–51 vs count session line 108). Renaming/archiving a product with stock makes the
   close impossible. Fix: include archived products that still have active batches in the count session
   (or let the count-one-item flow count them).
2. **Valuation preview shows €0.00 when nothing is priced (Codex).** `coalesce(sum(value_net),0)`; show "—"
   when every line is unpriced (honest-gaps rule).
3. **Purchasing tab race (Codex).** After saving a supplier on `?tab=suppliers`, clicking "Purchase orders"
   sometimes never shows "New purchase order" (e2e `inventory-workspace` test 1, intermittent).
4. **Receipt errors appear out of sight.** On a long receipt form the error is rendered at the top; the user at
   "Post delivery" sees nothing. Scroll/focus the alert, and say which product's batches don't add up
   (e.g. "Chicken: batches 24 kg, accepted 5 kg"). The stale error also stays after correction.
5. **Unlabelled controls (a11y).** Receipt dialog: Supplier field has no accessible name; Product select is
   announced as "Choose product". Batches page: view filter announced as "All active batches".
6. **Use / waste dialogs have no title.** Both look identical; add "Record use" / "Record waste" heading.
7. **New batch row prefills the remainder** and typing appends to it (2 → 21). Select the value on focus or
   leave empty with the remainder as placeholder.
8. **Stocktakes opens the last cancelled count** as if it were current. Open the start view when no draft exists.
9. **Valuation needs the cost typed again** although the receipt already has it (€30 / 5 kg). Prefill the
   suggested net cost from the receipt line; keep the explicit review.
10. **Long PO references** (32 hex chars) wrap badly on mobile; use the short 8-char form like older orders.
11. **CSP blocks Google Fonts** (fonts.googleapis.com / fonts.gstatic.com) — headings fall back to system font.

## Roles and branches — passed
- Staff A: purchasing, valuation, prices, staff, analytics, labour refused ("Managers only" / "Active manager
  access … required"); manager buttons rendered disabled; staff menu does not link to manager screens.
- Manager B: sees only Branch B; branch A receipt `QA-CLAUDE-001` and its batches invisible, also via search.
- Forged `sch_branch` cookie pointing to Branch A is ignored for a manager (server checks access).
- Brand owner: branch picker present; switching A → B reloads Branch B data with no A records.
- Cross-branch transfer covered by passing e2e `inventory-advanced`.

## Roles and branches — to fix in Phase 2
12. **Branch picker lists deactivated branches.** `branchChoices()` in `src/lib/activeBranch.ts` selects
    `branches` by accessible id without `is_active`; disabled E2E branches appear for the brand owner.
    Filter `.eq("is_active", true)` (keep the current branch if it was just deactivated).
13. **"All branches (HQ)" shows one branch's inventory.** With HQ selected, inventory pages show the home
    branch (A) without saying so. Show "Inventory is per branch — showing Branch A" or ask to pick a branch.
14. **Staff on a manager URL waits 15–40 s (staging) before the refusal.** Check the role on the server page and
    render the refusal immediately instead of after the client data call.

## Phase 2 status (Claude, 7 Nov — Codex offline)
| # | Status |
|---|---|
| 1 | Fixed: valuation "Reconcile these counts" rows get an inline count (existing `saveCount`, manager + branch checked). No SQL change. |
| 2 | Fixed: preview shows "—" when nothing is priced, "≥ €x" when partly priced. |
| 3 | Likely fixed: purchasing `load()` no longer calls `replaceState` when the URL is unchanged. Confirm with 3 e2e runs. |
| 4 | Fixed: receipt error scrolls into view, takes focus, clears on edit; batch mismatch names product and totals. |
| 5 | Fixed: Supplier field named. (Product select was already named — tool artefact.) |
| 6 | Fixed for all 16 dialogs: `NativeDialog` renders its title as a visible heading; duplicate headings removed. |
| 7 | Fixed: batch quantity selects its prefilled value on focus. |
| 8 | Fixed: Stocktakes opens only an open draft by itself. |
| 9 | Deferred — needs a business decision (receipt cost may be gross; valuation needs reviewed net). |
| 10 | Won't fix — long references are an intentional uniqueness change (from `20261104123000`). |
| 11 | Fixed: fonts self-hosted with `next/font` (no Google request; GDPR, LG München I 2022). |
| 12 | Fixed: branch picker lists only active branches. |
| 13 | Fixed: inventory shows a note in "All branches (HQ)" view (CSS-only). |
| 14 | Deferred — direct-URL-only; buttons already disabled and menu hidden for staff. |

Checks: all 47 CI scripts and 148 unit tests pass in the sandbox. Run `npx tsc --noEmit` and the 5 inventory e2e suites on staging before the PR.

## Not yet covered
Keyboard-only pass; production timing comparison after Phase 3 deploy.
