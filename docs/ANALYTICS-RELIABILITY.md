# Release D — Reliable analytics (design note)

Status: **approved by owner 2026-10-21** (decisions at the bottom). Builds on Release C.
Rule for every figure: **missing data is never zero, and a cost is shown only
when the records support it.**

## What is wrong today (verified in code, 2026-10-21)
| # | Where | Problem | Effect |
|---|---|---|---|
| F1 | Inventory → Reports, Home dashboard "Food cost %" | Computed as **purchase spend ÷ sales**. That is purchasing, not food cost (cost of goods actually used). | A big delivery week looks like terrible food cost; a week living off stock looks great. |
| F2 | `branch-analytics.ts` (labour cost %, purchases %, sales per labour hour), inventory "food cost %" | Divides by sales even when **sales were not entered for some days** (the code already counts `salesDays` vs `elapsedDays` but ignores it). | Percentages inflated, silently. |
| F3 | Labour cost totals (Analytics KPIs, branch comparison, staff performance) | Staff **without a confirmed wage** are left out of the euro total. Only the % is withheld. | Labour cost understated but shown as a complete number. Branch comparison ranks on it. |
| F4 | Purchase spend (analytics + inventory) | A delivery with **no cost entered counts as €0**. | Spend understated. |
| F5 | Inventory → Reports usage value / stock value | All-or-nothing: one product with a transfer or a single count hides usage for **every** product. Unit price only from purchases inside the window. | Usage value is almost always "—", so the screen gives nothing. |

## Proposal
1. **Coverage on every money figure.** Each figure is returned as
   `{ value, complete, missing }` — e.g. `missing: { wages: 2, salesDays: 3, costs: 1 }`.
   The UI shows the number only when complete; otherwise the reason ("Sales missing
   for 3 days"). Pure helper + unit tests; reused by analytics, dashboard, inventory.
2. **Percentages only on complete denominators** — sales entered for every elapsed
   open day of every branch in scope (F2).
3. **Rename and split F1:**
   - "Purchases % of sales" = spend ÷ sales (what it is today, honestly labelled).
   - "Cost of goods used % of sales" = used quantity (from Release C reconciliation,
     clean intervals only) × unit price ÷ sales — shown only when every counted
     product has a clean, priced interval in the period.
4. **Usage value per product** (F5) from reconciliation: OK and Unusual intervals
   count; Gain and Uncertain are withheld and listed. The product list shows which
   products are covered instead of blanking all of them.
5. **Labour cost** (F3) and **spend** (F4): totals carry their coverage; branch
   comparison doesn't rank a branch on an incomplete labour cost.

Build plan: D1 coverage helper + tests → D2 branch analytics (F2/F3/F4) →
D3 inventory reports + dashboard (F1/F5) → D4 EN/DE labels, staging pass, runbook.
No database migration expected.

## Not in scope
Item-level sales/POS, recipe costing, theft detection, VAT handling, forecasting.

## Owner decisions (2026-10-21)
1. Unit price: **latest delivery price on or before the date** (any time), not the period average.
2. Incomplete figures: **show the known part marked incomplete with the reason**
   (e.g. "≥ €4,210 · 2 staff without wage"); **percentages stay hidden** until complete.
3. Food cost: **split** into "Purchases % of sales" and a true "Cost of goods used %"
   (shown only when counts support it).
