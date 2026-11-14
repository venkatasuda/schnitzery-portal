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
