# Portal audit status

Read this file before older handoff notes. Check Git and deployment state before
treating local changes as live. AI billing and further AI work are deferred.

## Latest recorded release and local state — updated 2026-10-21

- Local branch: `codex/offline-roster-integrity`; implementation commit `e5b7d46`.
  No remote-tracking branch contains that commit in the local Git inventory.
- Latest recorded production main: `94614db9401ac829ce2a75500ca520d03f917934`,
  Vercel deployment `DgYUHBVhibK7cPxCjLPET2CAn3KP` (#43).
  This is the last verified release, not a fresh production inspection today.
- Review entry point: [CLAUDE-REVIEW-HANDOFF.md](../CLAUDE-REVIEW-HANDOFF.md).
- The offline migration remains unapplied. Local staging has not been bootstrapped
  or verified; see the staging section below. Do not treat a Vercel preview as an
  isolated database environment.

## Historical verified production baseline — 2026-10-13

- Main `c42430e71fcc5eb7581e0e6c8925d1dee79e7b99`; production deployment
  `dpl_FJBR515GAdsMCmwvuJB3hU4m5EiP` is Ready at schnitzery-portal.vercel.app.
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

### Local batch — 2026-10-17, not deployed

Offline attendance now requires a confirmed owner and a successful durable write
before showing a saved state. Web Locks protect concurrent browser-tab writes.
Replay verifies the authenticated owner, acknowledgements, capture protocol,
QR requirements, chronology, overlapping shifts and a seven-day replay window.
Unverified evidence is retained for manager review rather than adding hours.
Server review notes are immutable and branch scoped; reviewing does not approve
hours or payroll. Existing captures from older versions require review.

Roster saves compare the loaded snapshot before updating; copying a week refuses
an existing plan. Failed reads hide editable stale data. Attendance/document reads
show recoverable errors. Four overlays now share native modal focus behaviour.
Service-worker install rejects redirected/private responses, private routes use
a public bilingual offline fallback, and unrelated origin caches are retained.
Future sales/purchases are excluded from current business totals; blank delivery
costs are rejected rather than silently treated as free purchases.

Verification: production build, TypeScript, 42 unit tests, existing regression
checks and isolated PostgreSQL workflow checks pass. New checks cover queue
ownership/storage/acknowledgements, replay/review permissions, service-worker
privacy and roster compare-and-swap. The final focused checks were rerun after
follow-up edits; browser testing is still pending.

Migration `20261017160350_offline_attendance_integrity.sql` is local only.
Do not deploy these screens before applying the migration in the target staging
environment. The supplied Vercel URL and Supabase ref were confirmed to be
production, not staging. Keep credentials in a local ignored environment file.
No production payroll/attendance records were changed for these tests. AI remains
deferred; its current production flag has not been rechecked for this handoff.

### Staging setup attempt — 2026-10-20

User chose the existing Schnitzery organization `ytkyidefqefejvxrqgcq` and then
authorized local staging instead of a paid cloud upgrade. Organization is Free;
creating `schnitzery-staging` was rejected by Supabase's two-free-project account
limit. No cloud project was created and no plan upgrade was performed.

Ignored work directory: `.audit-db/local-staging/`. Supabase config uses project
ID `schnitzery-local-staging`, API port 55321 and DB port 55322 to avoid an existing
unrelated local stack. Intended portal URL is `http://schnitzery.localhost:3100`;
it is not running. A source snapshot of `e5b7d46` was extracted under `app/` with
a junction to the repository's installed dependencies. No staging app environment
or synthetic test accounts were completed. Do not copy production `.env.local`.

Docker initially failed on its Secrets Engine `engine.sock` reparse point. A
rename attempt failed; automatic approval review blocked a subsequent removal
attempt. Neither repair succeeded. Docker later briefly answered with engine
29.8.2, then stopped during a Desktop update. Supabase image pulls/start failed.
The schema-only dump also failed and `schema-only.sql` was zero bytes when last
checked. Recheck engine/container state before resuming; do not import that file
as a baseline. No successful clone, local migration or browser-role proof exists.

The connected Supabase app exposed FarmersFresh rather than Schnitzery. CLI
login was saved in Windows Credential Manager but was not picked up by this CLI
session; an ignored helper bridged it in memory for authorized management reads.
Vercel's connector denied access, while its local CLI project inspection worked.
Never include the ignored helper, credential files or private historical
migrations in a review bundle. Recheck access instead of assuming it persists.

| Original audit area | Honest status |
| --- | --- |
| 1. Page UX | Several pages improved; native dialogs and error recovery expanded locally. Full keyboard/German/mobile sweep still pending. |
| 2. Role workflows | Covered server/database boundaries pass isolated checks. Staging browser workflows still pending. |
| 3. Payroll | Frozen approvals and wage history deployed. Actual effective dates remain unconfirmed by user instruction; historical branch assignments remain open. |
| 4. Stock history | Append-only evidence deployed. Reconciliation and verified valuation/consumption are not implemented. |
| 5. Business inputs | Coverage and estimate safety deployed; future-date/blank-cost fixes local. Reliable opening values and confirmed prices still needed. |
| 6. Offline/privacy | Queue, replay, review and cache fixes implemented locally. Real browser disconnection/account-switch proof still pending. |

The paragraphs below describe previously deployed work, not this local batch.

Staff search, native add-staff dialog, recoverable staff/profile/settings errors,
settings role/input boundaries and labelled report filters are deployed (#32/#33).
Live staff search, dialog focus/Escape/password masking, German labels and phone
fit passed. Roster/reports fit desktop and phone widths. Settings loaded with
labelled controls, no error and no horizontal overflow on 2026-10-13.
The Git integration failed to retrieve source twice; CLI upload of source matching
tested main succeeded. No staff, wage, payroll or attendance settings were changed
as part of live verification.

Labour read failures now show retry, not false zero costs. Missing wages and
absent sales records stay unknown; wage writes restore busy state after errors.
Effective-dated wage history is deployed (#36/#37): append-only versions, atomic
current-rate updates, per-work-date payroll rates, mixed-rate exports, and unknown
period approval gates. The user confirmed existing dates are unknown, so all 26
date inputs remain blank. Existing wage values are retained as unconfirmed
baselines. Live September payroll retains nine employee rows and blocks approval
for unconfirmed rates. Production permissions prevent direct browser wage writes;
history has RLS, and security advisors found no error-level issues.

Phone wage controls are deployed on main `38a0997`, deployment
`dpl_C1zfobUbnUsbtva7JXGCPybmoTUz`. Live 390px check: employee name width 231px,
no horizontal overflow, zero assumed dates. German effective-date labels also
loaded. No wage values were changed during verification.

Stock evidence history is live on main `2ffbfe2`, production deployment
`dpl_59RFr4S8DZwMBk6GMsKaN8zuL5rJ` (#40/#41). Live checks: 100 records on page
one, one older record, 12 waste-filter results, German labels and 390px internal
table scrolling without page overflow. Migration `20261015040536` is applied once;
101 baselines and four capture triggers. Security advisor: no error-level findings.
No business records were changed for testing; a synthetic waste probe rolled back.
Database triggers retain before/after records for counts, deliveries, waste and
transfers, including deletions. Authenticated source writes and journal entries
commit together; no-op updates are skipped. Manager reads use branch RLS, and
browser/service clients cannot forge or edit evidence. TRUNCATE is refused.
The production-schema dry run produced 101 historical snapshots and rolled back.
Isolated PostgreSQL and actual query/UI checks pass. Historical snapshots are explicitly unverified;
earlier deletions, opening balances and stock consumption remain unknown.

Current phase: withhold estimates when counts imply unexplained stock gains,
quantity inputs are invalid, or recorded sent/received transfers need reconciliation.
These cases no longer become zero usage or automatic order suggestions. Missing
purchase prices make counted-stock valuation unavailable. Estimates are explicitly
depletion (including waste/differences), not verified consumption. This is a safety
gate, not completed reconciliation: daily records cannot establish exact boundary
movement order, and deleted historical transfer legs cannot be reconstructed here.
The code graph represents the preceding release; refresh at a phase boundary,
rather than rebuilding for every small edit.

## Remaining work and evidence gaps

| Area | Status / next proof required |
| --- | --- |
| Page UX | Finish roster, staff, reports, settings and dialog checks at desktop/phone widths; German and keyboard checks. Changes alone are not a completed accessibility audit. |
| Role flows | Unit/isolated database boundaries pass for covered operations. Full employee/manager/branch-owner/brand-owner staging flows and cross-branch recovery remain unverified. Never use real payroll/attendance decisions as tests. |
| Payroll | Snapshot protection and effective-dated wage history are implemented. Managers must confirm actual dates before affected payroll can be approved. Historical branch assignments remain open. Business estimates use current rates; base pay excludes premiums, taxes and employer costs. |
| Stock | Evidence history is live. Reconciliation, consumption and valuation remain open; current phase adds estimate safety gates. A physical count is an observation, not an additive movement. Source writes require an authenticated actor, including maintenance writes; never fabricate one. Existing legacy rows without a branch cannot be scoped and are excluded from baselines. |
| Business inputs | Sales and purchase coverage are exposed; missing data remains unknown. Purchase spending is not food consumption cost or profit. Reliable prices/valuation must precede those figures. |
| Offline/privacy | Existing service-worker checks are not an end-to-end offline attendance or account-isolation proof. One Schnitzery brand with all branches/roles; no unrelated multi-tenant claims. |

## Efficient continuation

Use targeted file reads and existing regression scripts. Release a reviewed phase
through develop/main with exact-head CI. Do not reread the full repository or
refresh every graph artifact on every turn. Record evidence and unresolved limits;
do not infer a completion percentage from the number of closed tasks.
