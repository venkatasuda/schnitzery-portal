# Owner cockpit (Release J)

Built on the multi-branch picker (Release I). Patterns borrowed (ideas only, nothing bought):
SAP Fiori overview page (cards inform, pages act), Restaurant365 daily flash and prime cost,
7shifts labour % of sales.

## What owners get
| Where | What |
|---|---|
| Home (branch owner, or brand owner in a branch) | **This month vs. target**: Sales, Labour %, Purchases %, Prime cost %. Green ≤ target, amber ≤ target + 3 points, red above. Incomplete inputs show "—" with the reason, never 0%. Each tile links to where the number is fixed. |
| Home | **Yesterday flash**: sales vs. the same weekday last week (▲/▼ %), hours worked. Missing sales → "Enter sales" link. |
| Home → Needs attention (all managers) | Forgotten clock-outs (shifts open > 14 h) and days without sales this month. |
| `/targets` | Owner sets labour %, purchases % and prime cost % targets per branch. Managers can read them. |
| `/my-branches` | Branch comparison (week / month): attendance %, hours, labour cost — now for any owner/manager with 2+ branches, not only HQ. |
| Monthly summary | **Print / PDF**: one-page monthly result (sales − labour − purchases) for the tax advisor. Incomplete inputs print as "≥" with warnings. |
| Labour → Sales | **Import from till (CSV)**: any till's daily export; German or English headers, `;` or `,`, German or English numbers; same-day lines summed; unreadable lines listed. Re-import replaces a day, never doubles it. |

## Database
Migration `20261023160000_branch_targets.sql`: table `branch_targets` with RLS — read for
anyone with access to the branch, write for owners only (`is_owner()`), values validated
(labour/purchases 0–100 %, prime 0–200 %). Proven by `scripts/checks/branch-targets.cjs`.

## Checks
- `scripts/checks/branch-targets.cjs` (RLS + validation), in CI.
- `src/lib/sales/parseSalesCsv.test.ts` (German/English exports, no header, bad lines).

## Deploy
1. Merge; 2. apply `20261023160000_branch_targets.sql` (after `20261023120000_multi_branch_access.sql`);
3. owner opens Home → "Set targets".
Until the migration runs, the cockpit shows "No target set" and the targets page reports an error.

## Monday summary (push + bell)
Every Monday 06:00 UTC (07:00/08:00 Berlin) Vercel Cron calls `/api/cron/weekly-summary`.
Each active branch owner / brand owner gets one notification for last week across their
branches: sales (vs. the week before, like-for-like), hours worked, purchases and items
waiting. Missing sales say "not entered", never €0. German or English is chosen by the phone.
A second run for the same week sends nothing (idempotent). Logic: `src/lib/owner/weeklySummary.ts`
(tested); the route only reads data and sends.

**Setup once (Vercel → Project → Settings → Environment Variables, Production):**
`CRON_SECRET` = a random string of 32+ characters. Vercel sends it automatically with the
cron call; without it the route refuses every request. Push also needs the existing VAPID keys;
without them the summary still appears in the bell.

## Insights band (home, below the cockpit)
Ideas taken from big chains' owner dashboards, built on data we already have (no new tables):
- **Next week (forecast)** — like 7shifts/R365 "scheduled labour vs forecast": next week's roster ×
  shift times × current wages = planned labour cost; expected sales = average of the same weekday
  over the last 4 weeks. Gives the expected labour % *before* the week starts, coloured against the
  labour target. No roster / missing wages / no history → "—".
- **Last 8 weeks** — sales, labour % and sales per labour hour (SPLH) per full week as small bars.
  Weeks with sales missing for a worked day are drawn faded and give no ratio.
- **Branch health** (0–100) — like a chain's operations scorecard: share of routine work done in the
  last 7 days — temperature checks (unit × day), checklists ticked, sales entered for worked days,
  shifts reviewed. Parts with nothing to measure are left out. Also shown per branch on
  "All my branches". Thresholds: ≥ 90 green, ≥ 75 amber, else red.
Maths: `src/lib/owner/insights.ts` (tested); data: `src/lib/queries/owner-insights.ts`.

## Next (not built)
Direct till API connection once we know the branches' till system.
