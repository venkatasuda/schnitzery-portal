# Graph Report - Schnitzery  (2026-10-12)

## Corpus Check
- 314 files · ~237,516 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 33 file(s) not represented in the graph (top: (none) 13, .xml 10, .properties 2)

## Summary
- 2059 nodes · 5072 edges · 165 communities (95 shown, 70 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- inventory page
- branch analytics
- attendance page
- staff page
- roster page
- cover
- attendance-hub page
- BottomNav
- DocumentsSection
- (app) page
- operations
- announcements page
- production functions
- directory page
- production schema
- availability page
- leave balance
- production schema
- transfer
- main
- NotificationBell
- package
- sentryScrub
- layout
- leave page
- package
- tsconfig
- CONTINUE HERE
- checklist page
- temp page
- atomic workflows
- dashboard
- inventory
- production functions
- geofence
- ARCHITECTURE
- dev config
- branches page
- kiosks page
- package
- inventory data
- compliance page
- production schema
- Project configuration
- business ui
- attendance review
- business date
- payroll query
- expiring-docs page
- privacy page
- terms page
- database.types
- production schema
- payroll ui
- layout
- make overview doc
- make overview doc de
- make demo data
- seed team
- order page
- CI CD
- action contrast
- business
- create demo accounts
- ops page
- Project configuration
- production functions
- production functions
- production schema
- make feature doc
- rotate passwords
- approvals ui
- payroll access
- summary page
- 20261012001000 payroll approval snapshots
- PURGE PII FROM HISTORY
- tsconfig.agentcheck
- 03 user pay step a
- INVENTORY UX PROPOSAL
- package
- Project configuration
- Project configuration
- production functions
- production schema
- sw
- DESIGN
- BRANCHING
- MOBILE APP
- PUSH NOTIFICATIONS SETUP
- README
- README
- proxy
- action page
- 20261012110618 attendance correction integrity
- 05 push subscriptions
- 07 login lock
- 08 fix guard hourly wage
- production functions
- production functions
- production functions
- production schema
- production schema
- production schema
- ci
- MainActivity
- capacitor.config
- MONOREPO MIGRATION
- ROADMAP
- make icons
- 04 user pay step c drop
- production functions
- production functions
- production functions
- production schema
- dependabot
- codeql
- AGENTS
- RULES
- UI UX AUDIT
- postcss.config
- package
- seed stuttgart inventory
- production functions
- production functions
- production functions
- production functions
- production functions
- production functions
- production functions
- Project configuration
- production schema
- production schema
- production schema
- production schema
- production schema
- Project configuration
- ARCHITECTURE
- PRD
- PRD
- PRD
- PRD
- PROJECT MEMORY
- RULES

## God Nodes (most connected - your core abstractions)
1. `useLang()` - 143 edges
2. `toast()` - 129 edges
3. `Icon()` - 128 edges
4. `createClient()` - 121 edges
5. `CardSkeleton()` - 94 edges
6. `react` - 87 edges
7. `berlinToday()` - 71 edges
8. `next` - 65 edges
9. `readAll()` - 43 edges
10. `InventoryPage()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `Either side scoped stock transfers` --conceptually_related_to--> `Per branch operational data`  [INFERRED]
  README.md → docs/PRD.md
- `Offline attendance replay` --conceptually_related_to--> `Server stamped attendance`  [INFERRED]
  README.md → docs/ARCHITECTURE.md
- `Feature to develop to main release flow` --conceptually_related_to--> `Blocking typecheck tests coverage and build`  [INFERRED]
  docs/RULES.md → .github/workflows/ci.yml
- `AnalyticsPage()` --indirect_call--> `berlinToday()`  [INFERRED]
  src/app/(app)/analytics/page.tsx → src/lib/time/berlinDate.ts
- `useMyLocation()` --calls--> `toast()`  [EXTRACTED]
  src/app/(app)/geofence/page.tsx → src/components/Toast.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Read only assistant safety boundary** — docs_architecture_phase1_agent, docs_architecture_agent_tools, docs_architecture_caller_session [EXTRACTED 1.00]

## Communities (165 total, 70 thin omitted)

### Community 0 - "inventory page"
Cohesion: 0.06
Nodes (101): vitest, plusDaysISO(), POST(), runTool(), Sb, SYSTEM(), TOOLS, ExpiryPage() (+93 more)

### Community 1 - "branch analytics"
Cohesion: 0.05
Nodes (88): recharts, @supabase/supabase-js, AnalyticsPage(), ChartCard(), Kpi(), Period, TEAM_COLORS, tooltip (+80 more)

### Community 2 - "attendance page"
Cohesion: 0.05
Nodes (77): POST(), VALID_ROLES, WEAK_PASSWORDS, POST(), POST(), POST(), AttendancePage(), applyOptimistic() (+69 more)

### Community 3 - "staff page"
Cohesion: 0.05
Nodes (74): Field(), input, primaryBtn, ProfilePage(), load(), save(), Row(), card (+66 more)

### Community 4 - "roster page"
Cohesion: 0.05
Nodes (70): AvailabilityPage(), save(), card, input, NoShowPage(), checkNoShows(), loadMissing(), primaryBtn (+62 more)

### Community 5 - "cover"
Cohesion: 0.06
Nodes (65): CoverPage(), doCancel(), doClaim(), doDecide(), doRequest(), loadAll(), fmtDate(), Chip() (+57 more)

### Community 6 - "attendance-hub page"
Cohesion: 0.06
Nodes (66): ApprovalsPage(), confirmReject(), decide(), load(), remove(), CORR_KEY, Filter, fmtD() (+58 more)

### Community 7 - "BottomNav"
Cohesion: 0.07
Nodes (43): lucide-react, qrcode.react, AssistantPage(), AppLayout(), ChangePasswordForm(), ChangePasswordPage(), Batch, getKioskId() (+35 more)

### Community 8 - "DocumentsSection"
Cohesion: 0.09
Nodes (43): archiveBtn, cancelBtn, DOC_TYPES, DocumentsSection(), archive(), load(), onFile(), view() (+35 more)

### Community 9 - "(app) page"
Cohesion: 0.09
Nodes (41): DashboardStat(), fmtH(), HomePage(), ManagerDash(), OrgOverview, OwnerDash(), Shortcut(), StaffDash() (+33 more)

### Community 10 - "operations"
Cohesion: 0.10
Nodes (41): load(), berlinTodayStr(), card, ChecklistStatusPage(), load(), input, card, CATEGORIES (+33 more)

### Community 11 - "announcements page"
Cohesion: 0.10
Nodes (33): web-push, AnnouncementsPage(), del(), load(), pin(), post(), card, CAT_COLORS (+25 more)

### Community 12 - "production functions"
Cohesion: 0.05
Nodes (20): announcements, app_config, attendance_corrections, attendance_events, audit_logs, auth_throttle, availability, branch_settings (+12 more)

### Community 13 - "directory page"
Cohesion: 0.14
Nodes (20): AuditPage(), card, ClockDisplayPage(), card, DirectoryPage(), iconBtn, TEAM_COLORS, escapeHtml() (+12 more)

### Community 14 - "production schema"
Cohesion: 0.07
Nodes (9): app_config, auth_throttle, cover_requests_branch_status_idx, cover_requests_requester_idx, daily_sales, idx_checklist_branch, idx_incident_branch, inventory_purchases_branch_date_idx (+1 more)

### Community 15 - "availability page"
Cohesion: 0.12
Nodes (16): react, input, lbl, TYPES, card, DAYS, primaryBtn, SHIFTS (+8 more)

### Community 16 - "leave balance"
Cohesion: 0.19
Nodes (21): backLink, fmtH(), Row(), StaffDetailPage(), saveAllowance(), Stat(), bwHolidays(), computeBalance() (+13 more)

### Community 17 - "production schema"
Cohesion: 0.15
Nodes (21): announcements, attendance_corrections, attendance_events, attendance_logs, audit_logs, availability, branch_settings, branches (+13 more)

### Community 18 - "transfer"
Cohesion: 0.28
Nodes (20): fmtWhen(), TransfersPage(), act(), loadAll(), resetForm(), submit(), admin(), branchNames() (+12 more)

### Community 19 - "main"
Cohesion: 0.19
Nodes (18): Terraform module: infra/terraform, google_artifact_registry_repository.repo, google_cloud_run_v2_service.web, google_project_service.svc, google_secret_manager_secret_iam_member.svc_role_access, google_secret_manager_secret_iam_member.vapid_access, google_secret_manager_secret.svc_role, google_secret_manager_secret.vapid_private (+10 more)

### Community 20 - "NotificationBell"
Cohesion: 0.15
Nodes (14): NOTIF, NotificationsPage(), load(), markRead(), CORR_KEY, DOC_TYPE_KEYS, NOTIF, NotificationBell() (+6 more)

### Community 21 - "package"
Cohesion: 0.11
Nodes (18): eslintConfig, name, private, version, @anthropic-ai/sdk, @capacitor/android, @capacitor/core, eslint (+10 more)

### Community 22 - "sentryScrub"
Cohesion: 0.18
Nodes (12): csp, nextConfig, supabaseHost, @sentry/nextjs, onRouterTransitionStart, onRequestError, register(), isSensitiveKey() (+4 more)

### Community 23 - "layout"
Cohesion: 0.10
Nodes (16): assert, exported, fs, layout, path, React, { renderToStaticMarkup }, root (+8 more)

### Community 24 - "leave page"
Cohesion: 0.18
Nodes (18): card, Field(), input, LeavePage(), loadMine(), submit(), primaryBtn, TabBtn() (+10 more)

### Community 25 - "package"
Cohesion: 0.11
Nodes (19): dependencies, @anthropic-ai/sdk, @capacitor/android, @capacitor/cli, @capacitor/core, docx, html5-qrcode, lucide-react (+11 more)

### Community 26 - "tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 27 - "CONTINUE HERE"
Cohesion: 0.11
Nodes (12): Database contact privacy deferred, Historical operational handoff, Three-strike login lock requires manager unblock, Multi-branch ownership aggregation deferred, VAPID deployment variables and phone verification required, Shared seed credential rotation explicitly deferred, Historical production readiness audit, Database RLS and definer functions carry security boundaries (+4 more)

### Community 28 - "checklist page"
Cohesion: 0.17
Nodes (13): BranchDetailPage(), Stat(), berlinTodayStr(), card, ChecklistStatusPage(), input, ConflictsPage(), card (+5 more)

### Community 29 - "temp page"
Cohesion: 0.31
Nodes (16): fmtWhen(), KINDS, TempPage(), doAddUnit(), doLog(), doRemoveUnit(), loadCore(), loadHistory() (+8 more)

### Community 30 - "atomic workflows"
Cohesion: 0.16
Nodes (10): assert, fs, path, { PGlite }, assert, fs, {PGlite}, assert (+2 more)

### Community 31 - "dashboard"
Cohesion: 0.12
Nodes (14): assert, exportsForCheck, fs, hq, owner, path, props, React (+6 more)

### Community 32 - "inventory"
Cohesion: 0.12
Nodes (15): assert, count, counts, exported, forecast, fs, names, path (+7 more)

### Community 33 - "production functions"
Cohesion: 0.12
Nodes (14): idx_clock_overrides_user, public.audit_user_document(), public.clock_code_batch(), public.clock_code_for(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token() (+6 more)

### Community 35 - "geofence"
Cohesion: 0.30
Nodes (14): GeofencePage(), doGrant(), load(), save(), useMyLocation(), Staff, GeofenceMode, getGeofence() (+6 more)

### Community 36 - "ARCHITECTURE"
Cohesion: 0.13
Nodes (10): accessible_branch_ids SQL helper, Stock expiry and waste read tools, Agent tools use caller RLS session, Next.js 16 App Router, Flag gated read only AI assistant, Separate schnitzery ops agent framework, Supabase Postgres Auth and RLS, Six tier role hierarchy (+2 more)

### Community 37 - "dev config"
Cohesion: 0.14
Nodes (11): typescript, assert, fs, ts, vm, assert, fs, path (+3 more)

### Community 38 - "branches page"
Cohesion: 0.16
Nodes (4): next, BranchesPage(), Mini(), Total()

### Community 39 - "kiosks page"
Cohesion: 0.35
Nodes (12): btn, KiosksPage(), add(), load(), saveName(), toggle(), createKiosk(), getMe() (+4 more)

### Community 40 - "package"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/qrcode, @types/react (+5 more)

### Community 41 - "inventory data"
Cohesion: 0.18
Nodes (12): allRows, assert, count(), exportsObject, fs, key(), master(), require() (+4 more)

### Community 42 - "compliance page"
Cohesion: 0.27
Nodes (9): CompliancePage(), ICON, Stat(), card, navBtn, OverviewPage(), Stat(), Skeleton() (+1 more)

### Community 43 - "production schema"
Cohesion: 0.15
Nodes (12): public.audit_user_document(), public.clock_code_batch(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token(), public."current_role"(), public.grant_clock_override() (+4 more)

### Community 45 - "business ui"
Cohesion: 0.17
Nodes (9): assert, data, dictionary, fs, overview, React, { renderToStaticMarkup }, ts (+1 more)

### Community 46 - "attendance review"
Cohesion: 0.18
Nodes (9): api, assert, client, corrections, fs, imports, tables, ts (+1 more)

### Community 47 - "business date"
Cohesion: 0.18
Nodes (9): assert, attendanceSource, BusinessClock, exportsForTest, fs, rangeNode, ranges, ts (+1 more)

### Community 48 - "payroll query"
Cohesion: 0.18
Nodes (9): api, assert, client, fs, revision, run, source, ts (+1 more)

### Community 49 - "expiring-docs page"
Cohesion: 0.25
Nodes (9): Bucket, DOC_TYPE_KEYS, EmptyOk(), ExpiringDocsPage(), fmtDate(), rowLink(), sel, statusInfo() (+1 more)

### Community 50 - "privacy page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, PrivacyPage(), Section() (+2 more)

### Community 51 - "terms page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, Section(), TermsPage() (+2 more)

### Community 52 - "database.types"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 53 - "production schema"
Cohesion: 0.18
Nodes (6): idx_branches_franchise, idx_clock_overrides_user, public.clock_code_for(), public.clock_out(), public.clock_token_sig(), public.resolve_kiosk()

### Community 54 - "payroll ui"
Cohesion: 0.20
Nodes (9): react-dom, assert, fs, React, render(), visit(), {renderToStaticMarkup}, ts (+1 more)

### Community 55 - "layout"
Cohesion: 0.27
Nodes (6): @vercel/analytics, metadata, RootLayout(), viewport, CookieNotice(), PWARegister()

### Community 56 - "make overview doc"
Cohesion: 0.33
Nodes (8): benefit(), bwhy(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 57 - "make overview doc de"
Cohesion: 0.33
Nodes (8): benefit(), bullet(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 58 - "make demo data"
Cohesion: 0.29
Nodes (8): admin, ANNOUNCEMENTS, berlinToday(), clean(), env, firstBranch(), ITEMS, seed()

### Community 59 - "seed team"
Cohesion: 0.27
Nodes (8): admin, env, makePassword(), PREFIX, readRoster(), run(), slug(), VALID_ROLES

### Community 60 - "order page"
Cohesion: 0.33
Nodes (8): eur(), OrderPage(), copyGroup(), emailGroup(), groupText(), load(), printAll(), today()

### Community 61 - "CI CD"
Cohesion: 0.22
Nodes (6): Lint and dependency audit advisory, Typecheck tests build block CI gate, Deferred Cloud Run deployment with workload identity, Continuous integration and deployment guidance, Vercel Git integration handles deployment, Infrastructure deployment options

### Community 62 - "action contrast"
Cohesion: 0.22
Nodes (6): assert, base, css, fs, light, resolve()

### Community 63 - "business"
Cohesion: 0.22
Nodes (7): api, assert, fs, sb, tables, ts, vm

### Community 64 - "create demo accounts"
Cohesion: 0.28
Nodes (6): ACCOUNTS, admin, ensureAuthUser(), env, resolveBranch(), run()

### Community 65 - "ops page"
Cohesion: 0.39
Nodes (8): fmtClock(), fmtFromMs(), fmtLabor(), Metric(), OpsPage(), sel, todayStr(), getOpsFilters()

### Community 66 - "Project configuration"
Cohesion: 0.28
Nodes (3): public.current_clock_code(), public.guard_users_sensitive_update(), public.sync_attendance_events()

### Community 67 - "production functions"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 68 - "production functions"
Cohesion: 0.22
Nodes (6): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.clock_token_sig(), public.notification_sweep(), public.resolve_kiosk()

### Community 69 - "production schema"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 70 - "make feature doc"
Cohesion: 0.36
Nodes (6): docx, bullet(), doc, heading(), section(), sub()

### Community 71 - "rotate passwords"
Cohesion: 0.29
Nodes (5): admin, APPLY, env, makePassword(), run()

### Community 72 - "approvals ui"
Cohesion: 0.25
Nodes (6): assert, fs, React, { renderToStaticMarkup }, ts, vm

### Community 73 - "payroll access"
Cohesion: 0.25
Nodes (7): assert, client, exportsObject, fs, imports, ts, vm

### Community 74 - "summary page"
Cohesion: 0.39
Nodes (7): csvCell(), eur(), Kpi(), lastMonths(), SummaryPage(), downloadCsv(), load()

### Community 76 - "PURGE PII FROM HISTORY"
Cohesion: 0.29
Nodes (5): Employee data exposure incident, History purge, credential rotation and access review documented pending, Historical public employee roster exposure, Unique credential rotation after published shared password, Employee data history purge runbook

### Community 77 - "tsconfig.agentcheck"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, noEmit, skipLibCheck, extends, include

### Community 78 - "03 user pay step a"
Cohesion: 0.43
Nodes (4): idx_user_pay_branch, public.user_in_my_branches(), public.user_pay, trg_sync_user_pay_branch

### Community 79 - "INVENTORY UX PROPOSAL"
Cohesion: 0.33
Nodes (6): Improve existing portal instead of separate prototype, Purchases divided by sales is not consumption food cost, Mailto opens client and does not prove supplier submission, Missing prices require partial order estimates, Route backed inventory workflow navigation, Separate unknown stale failed and healthy stock states

### Community 80 - "package"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 81 - "Project configuration"
Cohesion: 0.40
Nodes (3): idx_branches_franchise, public.clock_out(), public.sync_attendance_events()

### Community 83 - "production functions"
Cohesion: 0.33
Nodes (4): attendance_logs, branches, franchises, payroll_runs

### Community 84 - "production schema"
Cohesion: 0.33
Nodes (4): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.notification_sweep()

### Community 88 - "DESIGN"
Cohesion: 0.50
Nodes (3): Staff focused mobile bottom navigation, Management sidebar and collapsible mobile menu, Light desktop management workspace

### Community 89 - "BRANCHING"
Cohesion: 0.50
Nodes (4): Develop branch integration preview, Main branch triggers Vercel production, Feature to develop to main release flow, Branch protection requires CI gate and gitleaks

### Community 90 - "MOBILE APP"
Cohesion: 0.50
Nodes (3): Capacitor hybrid mobile deployment guide, Native plugin icon and splash changes require rebuild, Web deploy updates shell without native rebuild

### Community 91 - "PUSH NOTIFICATIONS SETUP"
Cohesion: 0.50
Nodes (3): Phone background delivery and tap routing acceptance test, Push notification setup runbook, VAPID keys identify browser push sender

### Community 93 - "README"
Cohesion: 0.50
Nodes (3): FIFO discard feeds waste log, Depletion forecast and reorder suggestions, Waste valued from delivery history

### Community 95 - "action page"
Cohesion: 0.83
Nodes (3): ActionCenterPage(), getActionCenter(), getStaffAlerts()

### Community 100 - "production functions"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 101 - "production functions"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 102 - "production functions"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 103 - "production schema"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 104 - "production schema"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 105 - "production schema"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 106 - "ci"
Cohesion: 0.67
Nodes (3): Lint and dependency audit advisory, Blocking typecheck tests coverage and build, Feature to develop to main release flow

### Community 110 - "ROADMAP"
Cohesion: 0.67
Nodes (3): Approval state machine draft through succeeded, Deferred background proposals approvals and tracing, Writes require approval and limited database role

## Knowledge Gaps
- **531 isolated node(s):** `config`, `eslintConfig`, `var.image`, `supabaseHost`, `csp` (+526 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 742 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `availability page` to `inventory page`, `branch analytics`, `attendance page`, `staff page`, `roster page`, `cover`, `attendance-hub page`, `BottomNav`, `DocumentsSection`, `(app) page`, `operations`, `announcements page`, `directory page`, `leave balance`, `transfer`, `NotificationBell`, `package`, `sentryScrub`, `layout`, `leave page`, `checklist page`, `temp page`, `dashboard`, `inventory`, `geofence`, `branches page`, `kiosks page`, `compliance page`, `business ui`, `expiring-docs page`, `payroll ui`, `layout`, `ops page`, `approvals ui`, `summary page`, `action page`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `next` connect `branches page` to `inventory page`, `branch analytics`, `attendance page`, `staff page`, `roster page`, `cover`, `attendance-hub page`, `BottomNav`, `(app) page`, `directory page`, `availability page`, `leave balance`, `NotificationBell`, `package`, `sentryScrub`, `checklist page`, `geofence`, `kiosks page`, `compliance page`, `expiring-docs page`, `privacy page`, `terms page`, `layout`, `ops page`, `summary page`, `proxy`, `action page`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `useLang()` connect `directory page` to `inventory page`, `branch analytics`, `attendance page`, `staff page`, `roster page`, `cover`, `attendance-hub page`, `BottomNav`, `DocumentsSection`, `(app) page`, `operations`, `announcements page`, `availability page`, `leave balance`, `transfer`, `NotificationBell`, `leave page`, `checklist page`, `temp page`, `geofence`, `branches page`, `kiosks page`, `compliance page`, `expiring-docs page`, `order page`, `ops page`, `summary page`, `action page`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `config`, `eslintConfig`, `var.image` to the rest of the system?**
  _531 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `inventory page` be split into smaller, more focused modules?**
  _Cohesion score 0.05919145690312738 - nodes in this community are weakly interconnected._
- **Should `branch analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.05267326732673267 - nodes in this community are weakly interconnected._
- **Should `attendance page` be split into smaller, more focused modules?**
  _Cohesion score 0.0509020618556701 - nodes in this community are weakly interconnected._

Scope note: 245 code files were structurally scanned. Documentation fragments retain the 28-file semantic snapshot from 2026-10-10; newly added documentation is not semantically indexed by this structural refresh. Generated images are excluded. See SOURCE_COVERAGE.json, CODE_AUDIT.md and docs/BUGFIXES.md.

Cost note: structural extraction uses no LLM tokens. Host-agent documentation token usage is unavailable; zero counters do not mean zero usage.
