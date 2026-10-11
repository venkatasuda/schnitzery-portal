# Graph Report - Schnitzery  (2026-10-11)

## Corpus Check
- 302 files · ~232,436 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 33 file(s) not represented in the graph (top: (none) 13, .xml 10, .properties 2)

## Summary
- 1971 nodes · 4917 edges · 171 communities (103 shown, 68 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- BottomNav
- attendance page
- attendance-hub page
- attendanceQueue
- ops dashboard
- cover
- operations
- DocumentsSection
- inventory page
- production functions
- staff page
- production schema
- payroll
- labor page
- availability
- analytics page
- rank
- leave balance
- waste
- production schema
- announcements page
- transfer
- package
- main
- sentryScrub
- expiry
- branch analytics
- package
- schedule page
- tsconfig
- CONTINUE HERE
- inventory page
- schedule-hub page
- temp page
- NotificationBell
- dashboard
- inventory
- admin
- production functions
- geofence
- ARCHITECTURE
- (app) page
- hours page
- package
- business ui
- inventory data
- summary page
- production schema
- Project configuration
- layout
- compliance
- analytics
- layout
- route
- expiring-docs page
- order page
- privacy page
- terms page
- database.types
- production schema
- create demo accounts
- business
- make overview doc
- make overview doc de
- make demo data
- seed team
- my-day page
- notifications page
- roster page
- Charts
- CI CD
- stock-alerts page
- Project configuration
- production functions
- production functions
- production schema
- atomic workflows
- rotate passwords
- make feature doc
- service worker
- dev config
- PURGE PII FROM HISTORY
- reproduce bugs
- tsconfig.agentcheck
- schedule insights
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
6. `react` - 85 edges
7. `next` - 66 edges
8. `berlinToday()` - 57 edges
9. `readAll()` - 40 edges
10. `AttendancePage()` - 36 edges

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

## Communities (171 total, 68 thin omitted)

### Community 0 - "BottomNav"
Cohesion: 0.05
Nodes (60): next, qrcode.react, AssistantPage(), AppLayout(), SearchPage(), ChangePasswordForm(), ChangePasswordPage(), Batch (+52 more)

### Community 1 - "attendance page"
Cohesion: 0.06
Nodes (67): CorrectionsPage(), cancel(), load(), pickRecord(), pickType(), submit(), fmtDate(), fmtTime() (+59 more)

### Community 2 - "attendance-hub page"
Cohesion: 0.06
Nodes (68): ApprovalsPage(), confirmReject(), decide(), load(), remove(), CORR_KEY, Filter, fmtD() (+60 more)

### Community 3 - "attendanceQueue"
Cohesion: 0.07
Nodes (56): react, Field(), input, primaryBtn, ProfilePage(), load(), save(), Row() (+48 more)

### Community 4 - "ops dashboard"
Cohesion: 0.07
Nodes (54): ActionCenterPage(), BranchDetailPage(), Stat(), BranchesPage(), Mini(), Total(), ConflictsPage(), btn (+46 more)

### Community 5 - "cover"
Cohesion: 0.08
Nodes (50): CoverPage(), doCancel(), doClaim(), doDecide(), doRequest(), loadAll(), fmtDate(), Chip() (+42 more)

### Community 6 - "operations"
Cohesion: 0.09
Nodes (45): berlinTodayStr(), card, ChecklistStatusPage(), load(), input, berlinTodayStr(), card, ChecklistStatusPage() (+37 more)

### Community 7 - "DocumentsSection"
Cohesion: 0.09
Nodes (43): archiveBtn, cancelBtn, DOC_TYPES, DocumentsSection(), archive(), load(), onFile(), view() (+35 more)

### Community 8 - "inventory page"
Cohesion: 0.14
Nodes (32): card, chip, fcColor(), Field(), input, InventoryPage(), doAddDelivery(), loadAnalytics() (+24 more)

### Community 9 - "production functions"
Cohesion: 0.05
Nodes (20): announcements, app_config, attendance_corrections, attendance_events, audit_logs, auth_throttle, availability, branch_settings (+12 more)

### Community 10 - "staff page"
Cohesion: 0.11
Nodes (28): card, DirectoryPage(), iconBtn, TEAM_COLORS, card, CONTRACTS, editBtn, Field() (+20 more)

### Community 11 - "production schema"
Cohesion: 0.07
Nodes (9): app_config, auth_throttle, cover_requests_branch_status_idx, cover_requests_requester_idx, daily_sales, idx_checklist_branch, idx_incident_branch, inventory_purchases_branch_date_idx (+1 more)

### Community 12 - "payroll"
Cohesion: 0.15
Nodes (26): eur(), fmtDate(), PayrollExportPage(), dl(), downloadCsv(), downloadExcel(), matrix(), payrollReport() (+18 more)

### Community 13 - "labor page"
Cohesion: 0.19
Nodes (21): vitest, eur(), input, LaborPage(), loadAll(), saveSale(), saveWage(), lbl (+13 more)

### Community 14 - "availability"
Cohesion: 0.15
Nodes (21): AvailabilityPage(), save(), card, DAYS, primaryBtn, SHIFTS, card, input (+13 more)

### Community 15 - "analytics page"
Cohesion: 0.16
Nodes (19): recharts, AnalyticsPage(), ChartCard(), Kpi(), Period, TEAM_COLORS, tooltip, OverviewPage() (+11 more)

### Community 16 - "rank"
Cohesion: 0.17
Nodes (18): @supabase/supabase-js, POST(), VALID_ROLES, WEAK_PASSWORDS, POST(), POST(), POST(), ActorCheck (+10 more)

### Community 17 - "leave balance"
Cohesion: 0.20
Nodes (20): backLink, fmtH(), Row(), StaffDetailPage(), saveAllowance(), Stat(), bwHolidays(), computeBalance() (+12 more)

### Community 18 - "waste"
Cohesion: 0.25
Nodes (21): eur(), fmtWhen(), REASON_EMOJI, REASONS, WastePage(), loadAll(), remove(), submit() (+13 more)

### Community 19 - "production schema"
Cohesion: 0.15
Nodes (21): announcements, attendance_corrections, attendance_events, attendance_logs, audit_logs, availability, branch_settings, branches (+13 more)

### Community 20 - "announcements page"
Cohesion: 0.20
Nodes (20): web-push, AnnouncementsPage(), del(), load(), pin(), post(), card, CAT_COLORS (+12 more)

### Community 21 - "transfer"
Cohesion: 0.28
Nodes (20): fmtWhen(), TransfersPage(), act(), loadAll(), resetForm(), submit(), admin(), branchNames() (+12 more)

### Community 22 - "package"
Cohesion: 0.10
Nodes (19): eslintConfig, name, private, version, @anthropic-ai/sdk, @capacitor/android, @capacitor/core, eslint (+11 more)

### Community 23 - "main"
Cohesion: 0.19
Nodes (18): Terraform module: infra/terraform, google_artifact_registry_repository.repo, google_cloud_run_v2_service.web, google_project_service.svc, google_secret_manager_secret_iam_member.svc_role_access, google_secret_manager_secret_iam_member.vapid_access, google_secret_manager_secret.svc_role, google_secret_manager_secret.vapid_private (+10 more)

### Community 24 - "sentryScrub"
Cohesion: 0.18
Nodes (12): csp, nextConfig, supabaseHost, @sentry/nextjs, onRouterTransitionStart, onRequestError, register(), isSensitiveKey() (+4 more)

### Community 25 - "expiry"
Cohesion: 0.28
Nodes (17): ExpiryPage(), discard(), loadAll(), resetForm(), submit(), used(), fmtDate(), validInventoryItem() (+9 more)

### Community 26 - "branch analytics"
Cohesion: 0.28
Nodes (19): shiftMinutes(), dayNameOf(), daysBetween(), emptyMetrics(), getAnalyticsScope(), getBranchAnalytics(), getBranchComparison(), getMe() (+11 more)

### Community 27 - "package"
Cohesion: 0.11
Nodes (19): dependencies, @anthropic-ai/sdk, @capacitor/android, @capacitor/cli, @capacitor/core, docx, html5-qrcode, lucide-react (+11 more)

### Community 28 - "schedule page"
Cohesion: 0.20
Nodes (16): DAYS, Field(), navBtn, primaryBtn, SchedulePage(), changeWeek(), doSubmitSwap(), loadShifts() (+8 more)

### Community 29 - "tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "CONTINUE HERE"
Cohesion: 0.11
Nodes (12): Database contact privacy deferred, Historical operational handoff, Three-strike login lock requires manager unblock, Multi-branch ownership aggregation deferred, VAPID deployment variables and phone verification required, Shared seed credential rotation explicitly deferred, Historical production readiness audit, Database RLS and definer functions carry security boundaries (+4 more)

### Community 31 - "inventory page"
Cohesion: 0.20
Nodes (17): copyOrderList(), copyShoppingList(), doAddProduct(), doRemoveProduct(), doSaveCount(), downloadShoppingCsv(), load(), quickSave() (+9 more)

### Community 32 - "schedule-hub page"
Cohesion: 0.21
Nodes (16): presetsFor(), RosterPage(), addEntry(), changeWeek(), doSave(), load(), BarRow(), Mini() (+8 more)

### Community 33 - "temp page"
Cohesion: 0.31
Nodes (16): fmtWhen(), KINDS, TempPage(), doAddUnit(), doLog(), doRemoveUnit(), loadCore(), loadHistory() (+8 more)

### Community 34 - "NotificationBell"
Cohesion: 0.17
Nodes (13): CORR_KEY, DOC_TYPE_KEYS, NOTIF, NotificationBell(), load(), openMenu(), OPS, getManagerAlerts() (+5 more)

### Community 35 - "dashboard"
Cohesion: 0.12
Nodes (14): assert, exportsForCheck, fs, hq, owner, path, props, React (+6 more)

### Community 36 - "inventory"
Cohesion: 0.12
Nodes (15): assert, count, counts, exported, forecast, fs, names, path (+7 more)

### Community 37 - "admin"
Cohesion: 0.24
Nodes (14): AuditPage(), card, card, input, primaryBtn, SettingsPage(), save(), getAuditLog() (+6 more)

### Community 38 - "production functions"
Cohesion: 0.12
Nodes (14): idx_clock_overrides_user, public.audit_user_document(), public.clock_code_batch(), public.clock_code_for(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token() (+6 more)

### Community 40 - "geofence"
Cohesion: 0.30
Nodes (14): GeofencePage(), doGrant(), load(), save(), useMyLocation(), Staff, GeofenceMode, getGeofence() (+6 more)

### Community 41 - "ARCHITECTURE"
Cohesion: 0.13
Nodes (10): accessible_branch_ids SQL helper, Stock expiry and waste read tools, Agent tools use caller RLS session, Next.js 16 App Router, Flag gated read only AI assistant, Separate schnitzery ops agent framework, Supabase Postgres Auth and RLS, Six tier role hierarchy (+2 more)

### Community 42 - "(app) page"
Cohesion: 0.30
Nodes (13): DashboardStat(), fmtH(), HomePage(), ManagerDash(), OrgOverview, OwnerDash(), Shortcut(), StaffDash() (+5 more)

### Community 43 - "hours page"
Cohesion: 0.27
Nodes (12): card, HoursPage(), load(), shiftMonth(), navBtn, Stat(), getMe(), getMyHours() (+4 more)

### Community 44 - "package"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/qrcode, @types/react (+5 more)

### Community 45 - "business ui"
Cohesion: 0.15
Nodes (10): react-dom, assert, data, dictionary, fs, overview, React, { renderToStaticMarkup } (+2 more)

### Community 46 - "inventory data"
Cohesion: 0.18
Nodes (12): allRows, assert, count(), exportsObject, fs, key(), master(), require() (+4 more)

### Community 47 - "summary page"
Cohesion: 0.27
Nodes (11): eur(), pct(), SimulatorPage(), csvCell(), eur(), Kpi(), lastMonths(), SummaryPage() (+3 more)

### Community 48 - "production schema"
Cohesion: 0.15
Nodes (12): public.audit_user_document(), public.clock_code_batch(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token(), public."current_role"(), public.grant_clock_override() (+4 more)

### Community 50 - "layout"
Cohesion: 0.17
Nodes (11): assert, exported, fs, layout, path, React, { renderToStaticMarkup }, root (+3 more)

### Community 51 - "compliance"
Cohesion: 0.30
Nodes (10): CompliancePage(), ICON, Stat(), breakMinutes(), dlabel(), getCompliance(), getMgr(), h1() (+2 more)

### Community 52 - "analytics"
Cohesion: 0.32
Nodes (9): DOW, getAnalytics(), getMgr(), isManager(), toH(), berlinMonday(), berlinMonth(), berlinWeekdayIndex() (+1 more)

### Community 53 - "layout"
Cohesion: 0.25
Nodes (6): @vercel/analytics, metadata, RootLayout(), viewport, CookieNotice(), PWARegister()

### Community 54 - "route"
Cohesion: 0.35
Nodes (8): plusDaysISO(), POST(), runTool(), Sb, SYSTEM(), TOOLS, validateToolInput(), validChatMessages()

### Community 55 - "expiring-docs page"
Cohesion: 0.25
Nodes (9): Bucket, DOC_TYPE_KEYS, EmptyOk(), ExpiringDocsPage(), fmtDate(), rowLink(), sel, statusInfo() (+1 more)

### Community 56 - "order page"
Cohesion: 0.33
Nodes (8): eur(), OrderPage(), copyGroup(), emailGroup(), groupText(), load(), printAll(), today()

### Community 57 - "privacy page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, PrivacyPage(), Section() (+2 more)

### Community 58 - "terms page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, Section(), TermsPage() (+2 more)

### Community 59 - "database.types"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 60 - "production schema"
Cohesion: 0.18
Nodes (6): idx_branches_franchise, idx_clock_overrides_user, public.clock_code_for(), public.clock_out(), public.clock_token_sig(), public.resolve_kiosk()

### Community 61 - "create demo accounts"
Cohesion: 0.24
Nodes (6): ACCOUNTS, admin, ensureAuthUser(), env, resolveBranch(), run()

### Community 62 - "business"
Cohesion: 0.20
Nodes (7): api, assert, fs, sb, tables, ts, vm

### Community 63 - "make overview doc"
Cohesion: 0.33
Nodes (8): benefit(), bwhy(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 64 - "make overview doc de"
Cohesion: 0.33
Nodes (8): benefit(), bullet(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 65 - "make demo data"
Cohesion: 0.29
Nodes (8): admin, ANNOUNCEMENTS, berlinToday(), clean(), env, firstBranch(), ITEMS, seed()

### Community 66 - "seed team"
Cohesion: 0.27
Nodes (8): admin, env, makePassword(), PREFIX, readRoster(), run(), slug(), VALID_ROLES

### Community 67 - "my-day page"
Cohesion: 0.27
Nodes (6): HubLink(), MyDayPage(), eur(), WasteByBranchPage(), MAP, getMyLeaveBalance()

### Community 68 - "notifications page"
Cohesion: 0.33
Nodes (6): NOTIF, NotificationsPage(), load(), markRead(), getNotificationHistory(), markAllNotificationsRead()

### Community 69 - "roster page"
Cohesion: 0.20
Nodes (9): DAYS, Entry, miniLbl, miniSelect, navBtn, primaryBtn, Roster, TEAM_COLORS (+1 more)

### Community 70 - "Charts"
Cohesion: 0.49
Nodes (9): DonutStat(), Legend(), MiniBars(), ProgressRing(), RankBars(), tip(), Tone, toneColor() (+1 more)

### Community 71 - "CI CD"
Cohesion: 0.22
Nodes (6): Lint and dependency audit advisory, Typecheck tests build block CI gate, Deferred Cloud Run deployment with workload identity, Continuous integration and deployment guidance, Vercel Git integration handles deployment, Infrastructure deployment options

### Community 72 - "stock-alerts page"
Cohesion: 0.47
Nodes (8): StockAlertsPage(), alertMe(), load(), saveLevel(), getStockAlerts(), isManager(), notifyLowStock(), setAlertLevel()

### Community 73 - "Project configuration"
Cohesion: 0.28
Nodes (3): public.current_clock_code(), public.guard_users_sensitive_update(), public.sync_attendance_events()

### Community 74 - "production functions"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 75 - "production functions"
Cohesion: 0.22
Nodes (6): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.clock_token_sig(), public.notification_sweep(), public.resolve_kiosk()

### Community 76 - "production schema"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 77 - "atomic workflows"
Cohesion: 0.25
Nodes (4): assert, fs, path, { PGlite }

### Community 78 - "rotate passwords"
Cohesion: 0.29
Nodes (5): admin, APPLY, env, makePassword(), run()

### Community 79 - "make feature doc"
Cohesion: 0.36
Nodes (6): docx, bullet(), doc, heading(), section(), sub()

### Community 80 - "service worker"
Cohesion: 0.25
Nodes (5): assert, fs, handlers, path, vm

### Community 81 - "dev config"
Cohesion: 0.25
Nodes (7): typescript, assert, fs, path, source, ts, vm

### Community 82 - "PURGE PII FROM HISTORY"
Cohesion: 0.29
Nodes (5): Employee data exposure incident, History purge, credential rotation and access review documented pending, Historical public employee roster exposure, Unique credential rotation after published shared password, Employee data history purge runbook

### Community 83 - "reproduce bugs"
Cohesion: 0.29
Nodes (4): assert, fs, ts, vm

### Community 84 - "tsconfig.agentcheck"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, noEmit, skipLibCheck, extends, include

### Community 85 - "schedule insights"
Cohesion: 0.38
Nodes (4): DAYS, getMe(), getScheduleOverview(), isManager()

### Community 86 - "03 user pay step a"
Cohesion: 0.43
Nodes (4): idx_user_pay_branch, public.user_in_my_branches(), public.user_pay, trg_sync_user_pay_branch

### Community 87 - "INVENTORY UX PROPOSAL"
Cohesion: 0.33
Nodes (6): Improve existing portal instead of separate prototype, Purchases divided by sales is not consumption food cost, Mailto opens client and does not prove supplier submission, Missing prices require partial order estimates, Route backed inventory workflow navigation, Separate unknown stale failed and healthy stock states

### Community 88 - "package"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 89 - "Project configuration"
Cohesion: 0.40
Nodes (3): idx_branches_franchise, public.clock_out(), public.sync_attendance_events()

### Community 91 - "production functions"
Cohesion: 0.33
Nodes (4): attendance_logs, branches, franchises, payroll_runs

### Community 92 - "production schema"
Cohesion: 0.33
Nodes (4): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.notification_sweep()

### Community 96 - "DESIGN"
Cohesion: 0.50
Nodes (3): Staff focused mobile bottom navigation, Management sidebar and collapsible mobile menu, Light desktop management workspace

### Community 97 - "BRANCHING"
Cohesion: 0.50
Nodes (4): Develop branch integration preview, Main branch triggers Vercel production, Feature to develop to main release flow, Branch protection requires CI gate and gitleaks

### Community 98 - "MOBILE APP"
Cohesion: 0.50
Nodes (3): Capacitor hybrid mobile deployment guide, Native plugin icon and splash changes require rebuild, Web deploy updates shell without native rebuild

### Community 99 - "PUSH NOTIFICATIONS SETUP"
Cohesion: 0.50
Nodes (3): Phone background delivery and tap routing acceptance test, Push notification setup runbook, VAPID keys identify browser push sender

### Community 101 - "README"
Cohesion: 0.50
Nodes (3): FIFO discard feeds waste log, Depletion forecast and reorder suggestions, Waste valued from delivery history

### Community 106 - "production functions"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 107 - "production functions"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 108 - "production functions"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 109 - "production schema"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 110 - "production schema"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 111 - "production schema"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 112 - "ci"
Cohesion: 0.67
Nodes (3): Lint and dependency audit advisory, Blocking typecheck tests coverage and build, Feature to develop to main release flow

### Community 116 - "ROADMAP"
Cohesion: 0.67
Nodes (3): Approval state machine draft through succeeded, Deferred background proposals approvals and tracing, Writes require approval and limited database role

## Knowledge Gaps
- **475 isolated node(s):** `config`, `eslintConfig`, `var.image`, `supabaseHost`, `csp` (+470 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 674 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **68 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `attendanceQueue` to `BottomNav`, `attendance page`, `attendance-hub page`, `ops dashboard`, `cover`, `operations`, `DocumentsSection`, `inventory page`, `staff page`, `payroll`, `labor page`, `availability`, `analytics page`, `leave balance`, `waste`, `announcements page`, `transfer`, `package`, `sentryScrub`, `expiry`, `schedule page`, `inventory page`, `schedule-hub page`, `temp page`, `NotificationBell`, `dashboard`, `inventory`, `admin`, `geofence`, `(app) page`, `hours page`, `business ui`, `summary page`, `layout`, `compliance`, `layout`, `expiring-docs page`, `order page`, `my-day page`, `notifications page`, `roster page`, `Charts`, `stock-alerts page`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `next` connect `BottomNav` to `attendance page`, `attendance-hub page`, `attendanceQueue`, `ops dashboard`, `cover`, `inventory page`, `staff page`, `payroll`, `labor page`, `analytics page`, `rank`, `leave balance`, `package`, `sentryScrub`, `schedule page`, `schedule-hub page`, `NotificationBell`, `admin`, `geofence`, `(app) page`, `summary page`, `compliance`, `layout`, `route`, `expiring-docs page`, `order page`, `privacy page`, `terms page`, `my-day page`, `notifications page`, `schedule insights`, `proxy`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `createClient()` connect `attendance page` to `BottomNav`, `attendance-hub page`, `attendanceQueue`, `ops dashboard`, `cover`, `operations`, `DocumentsSection`, `inventory page`, `staff page`, `payroll`, `labor page`, `availability`, `analytics page`, `rank`, `leave balance`, `waste`, `announcements page`, `transfer`, `expiry`, `branch analytics`, `schedule page`, `temp page`, `NotificationBell`, `admin`, `geofence`, `(app) page`, `hours page`, `compliance`, `analytics`, `route`, `my-day page`, `notifications page`, `schedule insights`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `config`, `eslintConfig`, `var.image` to the rest of the system?**
  _475 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BottomNav` be split into smaller, more focused modules?**
  _Cohesion score 0.05307950727883538 - nodes in this community are weakly interconnected._
- **Should `attendance page` be split into smaller, more focused modules?**
  _Cohesion score 0.06361570918532944 - nodes in this community are weakly interconnected._
- **Should `attendance-hub page` be split into smaller, more focused modules?**
  _Cohesion score 0.05765765765765766 - nodes in this community are weakly interconnected._

Scope note: 234 code files were structurally scanned. Documentation fragments retain the 28-file semantic snapshot from 2026-10-10; newly added documentation is not semantically indexed by this structural refresh. Generated images are excluded. See SOURCE_COVERAGE.json, CODE_AUDIT.md and docs/BUGFIXES.md.

Cost note: structural extraction uses no LLM tokens. Host-agent documentation token usage is unavailable; zero counters do not mean zero usage.
