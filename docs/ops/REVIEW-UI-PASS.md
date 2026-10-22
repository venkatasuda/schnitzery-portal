# Lead review — Codex UI pass (`codex/portal-ui-consistency`)

Claude, 2026-10-22. Reviewed the real diff (53 source/check/doc files, +266/−147, line-ending
noise ignored) against [UI-UX-PAGE-REVIEW.md](UI-UX-PAGE-REVIEW.md).

**Verdict: approve, merge after `fix/review-c-d`.** Re-ran `review-c-d`, `layout`,
`workspace-ux`, `inventory`, `business-ui` on the working tree — all pass.

## Good
- Real `<h1>` headings, labelled header search/profile, section breadcrumb (`ManagementLocation`) sharing one route table with the sidebar — and a check that every related route highlights exactly one nav item.
- Inventory count rows are native forms (Enter submits), keep input on failed save, release the busy state, block double submit, reject non-numeric/negative before the server. Covered by a real-handler check.
- Load failures show a retry instead of a false empty catalogue.
- Narrowed my `:has(> .data-table)` rule to data panels — answers handoff item 6.
- Print stylesheet; 16px fields on phones (no iOS zoom).
- Honest status: synthetic previews are labelled as such, staging acceptance listed as pending.

## Minor (follow-up, not blocking)
1. `color-mix()` is used in 37 inline styles, incl. employee pages (leave, cover, timesheet, temp, corrections). Safari supports it from 16.2; kitchen devices only need iOS ≥ 15.4. On 15.4–16.1 those tinted borders/backgrounds are dropped (cosmetic only). Prefer existing tokens (`--accent-soft` etc.) when those pages are next touched.
2. Invalid count entry shows the generic "failed" toast; a "enter a number ≥ 0" message would be clearer.

## Release order
1. Apply migration `20261022090000_stock_reviews_trusted_insert.sql` (after `20261021180000`).
2. PR `fix/review-c-d` → `develop`, CI, merge.
3. Commit this branch, PR `codex/portal-ui-consistency` → `develop` (it is based on `fix/review-c-d`, so the diff will then be UI-only), CI, merge.
4. `develop` → `main`, confirm the Vercel production build.
5. Signed-in staging acceptance per UI-UX-PAGE-REVIEW.md (desktop + 390px, EN/DE, manager/HQ/employee).
