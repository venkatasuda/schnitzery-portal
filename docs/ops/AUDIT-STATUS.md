# Portal audit status

Read this file before older handoff notes. Check Git and deployment state before
treating local changes as live. AI billing and further AI work are deferred.

## Verified production baseline — 2026-10-12

- Main `79fbd58e7c28ae64079db5706b9148bb56c4a08d`; production deployment
  `dpl_5eorgwCcFV4fmivH95G8cTWMLQsF` is Ready at schnitzery-portal.vercel.app.
- Desktop management shell and focused employee navigation; light theme and
  responsive inventory, operations, attendance, approvals and payroll layouts.
- Approved payroll reads immutable snapshots. Reopening retains old approvals.
  Source revisions and approval prerequisites are rechecked atomically.
- Attendance queues retain old pending shifts; stale decisions are rejected.
  Correction targets are bound to employee, branch and work date; invalid or
  repeated decisions roll back. Both payroll/correction migrations are applied.
- Build, TypeScript, 42 unit tests, regression checks, isolated PostgreSQL tests,
  secret scanning and CodeQL passed. Security advisors: no error-level findings.

## Current work

Staff search, native add-staff dialog, recoverable staff/profile/settings errors,
settings role/input boundaries and labelled report filters are deployed (#32/#33).
Live staff search, dialog focus/Escape/password masking, German labels and phone
fit passed. Roster/reports fit desktop and phone widths. Settings loaded with
labelled controls, no error and no horizontal overflow on 2026-10-13.
The Git integration failed to retrieve source twice; CLI upload of source matching
tested main succeeded. No staff, wage, payroll or attendance settings were changed
as part of live verification.

Current change: labour-page read failures must show retry rather than false zero
costs; missing wages and absent sales records must stay unknown. Wage edits need
labels, finite values, contrast and request protection. See Git/PR for release state.
The code graph represents the preceding release; refresh at a phase boundary,
rather than rebuilding for every small edit.

## Remaining work and evidence gaps

| Area | Status / next proof required |
| --- | --- |
| Page UX | Finish roster, staff, reports, settings and dialog checks at desktop/phone widths; German and keyboard checks. Changes alone are not a completed accessibility audit. |
| Role flows | Unit/isolated database boundaries pass for covered operations. Full employee/manager/branch-owner/brand-owner staging flows and cross-branch recovery remain unverified. Never use real payroll/attendance decisions as tests. |
| Payroll | Snapshot protection is complete. Effective-dated wages and historical branch assignments remain open. Drafts currently use current wage rates; base pay excludes premiums, taxes and employer costs. |
| Stock | Canonical movements, reconciliation, consumption and valuation remain open. Existing deliveries/transfers/waste/counts must feed one idempotent history without fabricating historical stock. |
| Business inputs | Sales and purchase coverage are exposed; missing data remains unknown. Purchase spending is not food consumption cost or profit. Reliable prices/valuation must precede those figures. |
| Offline/privacy | Existing service-worker checks are not an end-to-end offline attendance or account-isolation proof. One Schnitzery brand with all branches/roles; no unrelated multi-tenant claims. |

## Efficient continuation

Use targeted file reads and existing regression scripts. Release a reviewed phase
through develop/main with exact-head CI. Do not reread the full repository or
refresh every graph artifact on every turn. Record evidence and unresolved limits;
do not infer a completion percentage from the number of closed tasks.
