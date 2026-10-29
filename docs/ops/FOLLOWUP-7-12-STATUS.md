# Follow-up items 7–12

Checked 2026-10-29.

| Item | Evidence and remaining work |
| --- | --- |
| 7 — post-merge live checks | Not complete. Live HTTP probes failed DNS resolution in this session; Vercel project inspection returned 403. Owner home, login limits and the signed-in branch picker have not been verified live in this follow-up. Earlier production database permission checks are recorded in INVENTORY-OPERATIONS-IMPLEMENTATION.md; they do not substitute for a new post-merge acceptance run. |
| 8 — CAPTCHA | Not implemented or activated. Requires the chosen provider's site key and server-side Supabase configuration. |
| 9 — kiosk offline token window | Pending the offline-duration requirement. No arbitrary shorter window has been applied. |
| 10 — transfers and batches | Production guards and verification recorded in INVENTORY-OPERATIONS-IMPLEMENTATION.md. No production database mutation performed in this follow-up. |
| 11 — inventory formatting | Fixed remaining currency inconsistencies in overview, order draft and saved-order unit prices by reusing formatEur. Totals retain cents, unit prices retain up to four decimal places, English/German follow the selected app language. Reviewed calendar-date displays use fmtDay; inventory event timestamps explicitly use Europe/Berlin. Not a claim of exhaustive visual sign-off. |
| 12 — automatic POS integration | Not implemented; provider and integration access are unknown. |

Verification: format and Berlin-calendar suites passed (15 tests across two files); inventory UI regression passed. These source changes have not been deployed. A full production build was not run for this small follow-up.
