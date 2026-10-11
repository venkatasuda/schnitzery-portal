# Portal UI/UX source audit

Scope: all current page.tsx routes, shared shell, theme, hubs, dashboard and inventory. This is a source audit, not a claim that every signed-in page has been visually tested. Browser inspection was unavailable under the tool URL policy.

## Design direction

- Light default: white surfaces, slate text, blue actions; semantic green/amber/red for outcomes. Retain the saved dark preference.
- Use DM Sans for controls, tables, headings and metrics. Keep the display face for branding only.
- Management uses available desktop width. Employee pages stay focused; editors and confirmation dialogs keep useful reading widths.
- Sidebar owns global destinations; page tabs own local workflows. Dashboards prioritize metrics and exceptions rather than copying the sidebar.
- Hubs use a responsive desktop grid. Operational lists use the shared workspace width. Inventory separates counting, receiving, planning, analysis and catalog management.
- Retain real business queries and server authorization. No new metrics or inferred success states are introduced.

## Applied changes

Shared colors, controls, hub placement, table readability, route-level list width, chart theme integration and compact KPI typography. Existing inventory improvements and development stylesheet cache repair are retained.

## Follow-up validation

Verify signed-in views at 390px, 768px, 1280px and 1920px in both themes. Check keyboard focus, overflow, modal focus return, translated text, live data refresh and failure states. Route-specific concerns below remain recommendations unless marked updated; an updated route can still need further visual review.

## Route inventory

| Route | Review | Remaining checks |
|---|---|---|
| `/action` | Source reviewed | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/analytics` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify horizontal table scrolling on phones; Verify grid at tablet/phone widths |
| `/announcements` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/approvals` | Source reviewed | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/assistant` | Source reviewed | Shared styles applied; verify live interaction and empty/error states |
| `/attendance/corrections` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/attendance` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/attendance-hub` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/audit` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/availability` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/branches/[id]` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/branches` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/checklist` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/checklist-status` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/clock-display` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/compliance` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/conflicts` | Source reviewed | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/cover` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review |
| `/dashboard` | Source reviewed | Redirect: no separate UI to redesign |
| `/directory` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/expiring-docs` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/expiry` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review |
| `/export` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify horizontal table scrolling on phones; Verify grid at tablet/phone widths |
| `/geofence` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review |
| `/hours` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/incidents` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/inventory/order` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review; Verify horizontal table scrolling on phones |
| `/inventory` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/kiosks` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/labels` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/labor` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/leave` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/leave-calendar` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/my-day` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review |
| `/noshow` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/notes` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/notifications` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review |
| `/ops` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/overview` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Verify horizontal table scrolling on phones; Verify grid at tablet/phone widths |
| `/` | Source reviewed | Verify grid at tablet/phone widths |
| `/people-hub` | Source reviewed | Remaining literal colors need contrast review |
| `/profile` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/roster` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/schedule/compare` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/schedule` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review |
| `/schedule/shift-times` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review |
| `/schedule-hub` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/search` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels |
| `/settings` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Remaining literal colors need contrast review |
| `/settings-hub` | Source reviewed | Redirect: no separate UI to redesign |
| `/simulator` | Source reviewed | Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/staff/[id]` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/staff` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify grid at tablet/phone widths |
| `/stock-alerts` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/summary` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review; Verify horizontal table scrolling on phones; Verify grid at tablet/phone widths |
| `/temp` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review |
| `/timesheet` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/transfers` | Theme/layout updated | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/waste` | Theme/layout updated | Small metadata labels; Remaining literal colors need contrast review |
| `/waste-branches` | Source reviewed | Review list width; preserve focused forms/dialogs; Small metadata labels; Remaining literal colors need contrast review |
| `/change-password` | Source reviewed | Shared styles applied; verify live interaction and empty/error states |
| `/kiosk` | Source reviewed | Shared styles applied; verify live interaction and empty/error states |
| `/login` | Source reviewed | Shared styles applied; verify live interaction and empty/error states |
| `/privacy` | Source reviewed | Review list width; preserve focused forms/dialogs |
| `/terms` | Source reviewed | Review list width; preserve focused forms/dialogs |


## Workspace refinement — 2026-10-11

The shared rule that put every active hub panel into a grid has been removed. Attendance filters, summaries and records now retain their intended reading order; only peer panels in the schedule and people hubs use explicit responsive grids. Attendance summaries use readable body typography and responsive metric cards. Staff forms stack on phones and employee actions wrap. Profile administration links are grouped separately from account details. Branch settings use a left-aligned management workspace and body typography.

Legacy small route labels were raised to 12px and repeated green/red/amber status text now uses theme tokens. Dynamic translucent status backgrounds use color-mix so token colors remain valid CSS. Hub filter buttons expose their selected state with aria-pressed. Staff/profile fields wrap their controls in labels; attendance filters and GPS selection have accessible names.

Approvals has a structured request list with named Approve/Reject controls, global in-flight disabling, explicit failed-load and retry states, and a native rejection dialog with keyboard containment, Escape and focus return. The runnable approvals-ui check verifies failed reads cannot display a caught-up state.

These are UI improvements, not implementation of immutable payroll, movement accounting or unrelated backend architecture. Source changes cover operational routes; signed-in browser checks below must record the actual routes and viewports tested, not imply every permission or workflow was exercised.


## Live verification and contrast follow-up — 2026-10-12

UI release 402a1393ad2ea904faf10bb8009890eb81e1d4be is deployed on the public domain. Signed-in manager checks confirmed direct staff navigation, schedule primary action placement, attendance summaries/filters, the approvals empty queue and tablet branch settings. Checked widths include 390, 768, 1280 and 1920px; checks are recorded per route, not every route at every width. No approval, staff, stock or branch-setting records were changed.

The live review found legacy dark text paired with teal primary fills in several controls. Those controls now use the existing action/on-action token pair in both themes. The runnable action-contrast check calculates WCAG text contrast from the actual CSS tokens and requires at least 4.5:1. Removed the staff footer claiming account creation was still upcoming; replaced the obsolete GPS phase notice with current branch-configuration guidance in English and German.

The signed-in employee experience, owner-specific branch flows, populated approval decisions and every route/dialog have not all received live end-to-end verification. Immutable payroll snapshots and inventory movement accounting remain separate backend work. AI work remains deferred.
