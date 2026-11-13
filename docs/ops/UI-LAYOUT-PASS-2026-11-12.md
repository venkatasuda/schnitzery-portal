# Portal UI layout pass — 12 November 2026

Implemented in E:\Github Projects\Schnitzery. Local changes only; no push, deploy, schema change or production write.

## Scope

- Moved 46 legacy page components to the existing shared PageHeader, plus the main Inventory header. Includes employee, manager and owner pages: My Day, availability, schedule, roster, staff, attendance, approvals, analytics, overview, payroll/export, settings, operations and related screens.
- Kept the existing light/dark palette and standardized control alignment, shared header actions, filter labels, wrapping row actions, touch targets and equal-height form footer buttons.
- Inventory primary actions remain in the header; Analytics sales-import utility and Staff Add Staff action moved into their header action slots.
- Roster Save and Publish stay visible. Smart planning, draft copying and discarding are grouped under Planning tools. Desktop day columns have a readable minimum width and a keyboard-focusable horizontal week canvas instead of squeezed seven-column forms.
- Staff View/Edit remain visible. Password reset, unlock and removal are grouped under More actions, preserving their existing handlers and confirmation flows.
- Consumption uses a structured date/SKU/quantity/recipe table, expandable ingredient quantities, and a separated review footer. Mapping setup remains separate below the operational review. Existing validation, idempotency keys and warnings retained.
- Expiry navigation uses the existing receiving/resolve capabilities: managers receive inventory navigation; shift leaders return to their floor workspace. Stock-count sessions already had role-specific navigation and remain unchanged.
- My Day view selectors expose their selected state to assistive technology.

## Verification

- TypeScript noEmit PASS after repairing the Geofence conditional heading conversion in place.
- TSX parse sweep PASS (zero diagnostics).
- InventoryNav Vitest: 8 PASS.
- Existing security/pay/date regression script PASS.
- a11y-static PASS; design-token ratchet PASS; action text contrast PASS (dark 7.72:1, light 6.69:1).
- Workspace UX checks PASS. The test helper now traverses the shared header actions slot; its existing Add Staff/dialog assertions were retained.
- Browser presentation contract: 64 combinations PASS (staff/shift-leader/manager/owner layout × 390/768/1280/1440px × light/dark × English/German). Uses actual shared components and stylesheet with synthetic presentation fixtures, no accounts or business-data writes. Checks control visibility, touch sizes, filter baseline, page overflow and equal-height footer buttons. This is not authenticated end-to-end verification of all 88 pages.
- Disclosure + navigation Vitest: 11 PASS (3 disclosure behavior checks plus 8 navigation checks).
- Focused lint: 8 errors in existing roster hook patterns; read-only comparison with HEAD confirms the same 8 errors (3 immutability, 4 refs, 1 purity). No new error-rule counts in the reviewed files. Lint is NOT claimed globally clean.
- Final local production build: PASS (compilation, TypeScript, 96-route generation and tracing). Verified that the final coarse-pointer stylesheet rule is present in the packaged CSS.

## Review

Saved previews in ui-review-2026-11-12/shared-layout-390.png and shared-layout-1440.png are shared-component presentation fixtures, not screenshots of authenticated production pages. Run `node scripts/checks/portal-layout.cjs` to regenerate them.

No claim that every business workflow is complete or every runtime page has been visually signed off. The separate principal audit's database/concurrency/compliance work is not addressed by this UI pass. Existing source changes and backend contracts were preserved.

## Resume completion — 12 November

- My Day now uses URL-backed views with the required Next Suspense boundary. Reload/back restores the selected view, and tab changes preserve other query parameters without jumping the page.
- Visited views stay mounted but hidden when inactive, retaining local form values across tab switching; unopened views remain unloaded. This is in-page retention, not persistence across logout or a full reload.
- Employee back links return to the matching availability/time-off/hours/work view. Expiry owns its role-correct back link, so the shell no longer adds a duplicate.
- Expanded focused suite: 17 PASS across disclosure, inventory/employee navigation and My Day URL/retention checks.
- My Day and EmployeeBack lint: PASS with no errors; the earlier 8 pre-existing Roster lint errors remain separately documented.
- Accessibility naming and workspace UX checks PASS after the navigation changes.
- Final build including My Day history/form retention and touch-target styles: PASS; no deployment performed.
- Shared layout matrix remains 64 PASS, plus a coarse-pointer browser check for icon/remove/choice controls at 44px minimum.
- Source edits and local build verification are complete. Signed-in page-by-page browser review remains separate from the presentation checks.
