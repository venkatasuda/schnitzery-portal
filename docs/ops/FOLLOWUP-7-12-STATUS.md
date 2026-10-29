# Follow-up items 7–12

Checked 2026-10-29.

| Item | Evidence and remaining work |
| --- | --- |
| 7 — post-merge live checks | Partially complete. Vercel access restored. After release, login and CSS returned 200; dashboard, inventory, purchasing and branches redirected signed-out requests to login (307). Owner home, login limits and the signed-in branch picker have not been verified live in this follow-up. Earlier production database permission checks are recorded in INVENTORY-OPERATIONS-IMPLEMENTATION.md; they do not substitute for a new post-merge acceptance run. |
| 8 — CAPTCHA | Not implemented or activated. Requires the chosen provider's site key and server-side Supabase configuration. |
| 9 — kiosk offline token window | Pending the offline-duration requirement. No arbitrary shorter window has been applied. |
| 10 — transfers and batches | Production guards and verification recorded in INVENTORY-OPERATIONS-IMPLEMENTATION.md. No production database mutation performed in this follow-up. |
| 11 — inventory formatting | Fixed remaining currency inconsistencies in overview, order draft and saved-order unit prices by reusing formatEur. Totals retain cents, unit prices retain up to four decimal places, English/German follow the selected app language. Reviewed calendar-date displays use fmtDay; inventory event timestamps explicitly use Europe/Berlin. Not a claim of exhaustive visual sign-off. |
| 12 — automatic POS integration | Not implemented; provider and integration access are unknown. |

Verification: format and Berlin-calendar suites passed (15 tests across two files); inventory UI and operations regressions passed. PR #66 passed the complete CI gate: TypeScript, production build, unit/coverage, security/UI and atomic database regression steps. CodeQL and secret scanning also passed. PR merged as `5e209d559030eb3775167e513d71e88c2229cf30`.

Production deployment `dpl_EX6WhzgDrB1PggeatLKL9mFXU9dE` is READY and assigned to https://schnitzery-portal.vercel.app/. Post-deploy HTTP smoke checks passed. No error/fatal runtime log records were returned for this deployment during the immediate release check; this short observation does not prove all signed-in workflows. No production accounts were intentionally locked and no business records were edited during this release.
