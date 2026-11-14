# Signed-in UI review — 14 November 2026

## Scope and evidence

Local staging API only: http://127.0.0.1:55321. Isolated source mirror served on http://[::1]:3117. No deployment, push, production access or business-form submissions. Source-marker verification prevents silently testing an unrelated local server.

The pre-fix snapshot built successfully: compilation, TypeScript and 96 generated routes. The mirror emits standalone tracing warnings because dependencies are junctioned outside its root; this is not a deployment artifact.

- PASS: signed-in My Day retains unsaved availability through tab history.
- PASS: phone action disclosures stay within the viewport and Escape restores focus.
- Captured 170 route/viewport combinations: staff 16, manager 154, desktop English and phone German.
- Staff: home lacks a visible h1 at both widths; other captured staff pages passed the automated checks.
- Manager: phone Ingredient Prices has one clipped control; Labour, Schedule Hub and Schedule Compare emitted hydration errors. Other 150 manager combinations passed automated assertions. Passing assertions are not a visual sign-off of every dialog/state.
- Manually inspected staff phone home/My Day, manager desktop inventory/purchasing and phone inventory/prices screenshots.
- Owner and shift-leader review remains incomplete. The checkout changed during the run; the next worker correctly refused its stale source fingerprint. Do not bypass this guard or call the whole suite green.

Private screenshots and role JSON: C:/Users/Venky/Documents/Codex/schnitzery-signed-in-review-2026-11-14. These include only local synthetic staging data and are not committed.

## Fixes made after capture

1. Staff greeting becomes its existing visible h1, without adding a second title/card.
2. Shared Field file inputs are constrained to their container width.
3. appLocale accepts an explicit page language. Labour, Schedule Hub and Schedule Compare pass LanguageProvider locale so server HTML and hydration format dates consistently. Existing client-only cookie fallback is retained.
4. Review test source lookup uses CommonJS-compatible __dirname; the source marker is read using an authenticated local test context, preserving the login gate.

Concurrent Team Today/report-navigation changes were preserved and are not claimed as work from this review.

## Verification and next step

- Formatting: 3 tests PASS, including explicit locale during server rendering.
- Shared presentation contract: 64 role/viewport/theme/language combinations PASS; coarse-pointer targets and new constrained file-upload check PASS.
- Final TypeScript: PASS (npx tsc --noEmit --pretty false).
- The owned review server was stopped after capture so it cannot be mistaken for the updated portal.
- Post-fix signed-in retest and final build are still required on one stable source snapshot, including owner and shift-leader roles. The earlier successful build predates these fixes and concurrent edits.

Run the existing guarded launcher with --ui-review --fast, then E2E_BASE_URL=http://[::1]:3117 and the portal-visual-review.e2e.ts suite. Avoid editing src during this review. No production release is authorized by this report.


## Final local verification — completed 14 November

This section supersedes the incomplete-review status above. Source review built from the application snapshot at 74f203a (subsequent b6c11bd updates workspace instructions), plus the one-line table-containment fix; source fingerprints were verified by both review suites. No push, deploy or production database operation was performed.

### Results

- Current source production-mode build PASS: compilation, TypeScript and 97 routes. The isolated dependency-junction tracing warnings remain specific to the review mirror; it is not a deployment package.
- Broad signed-in run captured 212 route/viewport combinations across staff, manager, branch owner, brand owner and shift leader. Eight of ten tests initially passed. Two failed due to the missing local team_today migration and owner-table overflow; these failures were preserved, not hidden or relabelled.
- All 154 previously reviewed manager combinations passed after the earlier heading/upload/locale fixes. Only the newly added team page failed in that initial run.
- The existing migration 20261114120000_team_today.sql passed its PGlite permission check and was applied ONLY to supabase_db_schnitzery-local-staging (DB port 55322, API 55321). Both functions were confirmed present. It changes no business records. Production application/history was not inspected or changed; release must confirm that existing migration is applied there.
- Owner overflow reproduced at 375px: document width 904px caused by the offscreen sr-only Open label escaping its scroll container. Shared .table-scroll now establishes position: relative. Horizontal scrolling and the accessible label are preserved.
- Post-fix source-verified run: all four tests PASS. Brand-owner broad review passed at desktop/phone; 14 additional corrected-screen combinations passed at 375/1920px (German staff home, ingredient prices, labour, schedule hub/compare, team page, owner branches). No page overflow, runtime errors or data-load errors; owner Open remains reachable by scrolling.
- All three responsive-shell tests PASS: phone purchase row actions, manager toolbar/navigation/notifications/preferences, employee/owner controls, widths 320–1920px.
- Formatting: 3 tests PASS. Shared presentation matrix: 64 combinations PASS, plus coarse-pointer controls, file-input containment and offscreen accessible-table-label regression checks.
- Static accessibility naming, design-token ratchet, workspace UX and server-message translation checks PASS. No new palette, dependency, table, migration or production write was introduced by this UI review.
- Manually inspected the final 375px owner branch table and prices/team screens, and the 1920px price screen. The owner screenshot intentionally shows the table scrolled to its Open actions. Same feature order is retained; wide tables scroll inside their containers.

Final artifacts: C:/Users/Venky/Documents/Codex/schnitzery-signed-in-review-2026-11-14-verified (private synthetic staging data). Final post-fix build is running on http://[::1]:3117; the user's separate port 3100 server was not changed.

### Scope limits / push handoff

The reported UI defects are fixed and verified locally. This is not a claim that every inventory write, dialog, payroll transaction, offline recovery or production permission has been exhaustively retested. The full ten-test command was not rerun after the final CSS fix: the affected owner and manager screens were rerun specifically, alongside the shared 64-case regression matrix. No known failing UI assertion remains from this review.

Changed in this final pass: src/app/globals.css, scripts/checks/portal-layout.cjs, e2e/ui-final-review.e2e.ts and this report. Earlier fixes already in the user's current history were preserved. Ready for the user's code review/push step; production migration/deployment remains a separate release step.

Principal UI/UX self-check: existing tokens retained; controls/scroll containment verified; no new inline styles or colours; accessible hidden labels retained; desktop/mobile screenshots inspected; failures surfaced; no business-query or concurrency rules changed.
