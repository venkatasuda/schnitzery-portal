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
