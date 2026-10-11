# Graph Report - Schnitzery  (2026-10-11)

## Corpus Check
- 298 files · ~230,044 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: (none) 12, .xml 10, .properties 2)

## Summary
- 1948 nodes · 4869 edges · 175 communities (108 shown, 67 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- attendance page
- attendance-hub page
- branch analytics
- staff page
- DocumentsSection
- operations
- cover
- NotificationBell
- inventory page
- production functions
- compare page
- production schema
- rank
- hours page
- availability
- index
- ThemeToggle
- export page
- waste
- analytics page
- leave balance
- production schema
- transfer
- main
- sentryScrub
- announcements page
- leave page
- package
- package
- (app) page
- schedule page
- tsconfig
- CONTINUE HERE
- schedule-hub page
- temp page
- dashboard
- inventory
- shift conflicts
- branches page
- expiry
- production functions
- geofence
- ARCHITECTURE
- kiosks page
- package
- layout
- inventory data
- route
- loginThrottle
- production schema
- Project configuration
- order page
- analytics
- Charts
- layout
- simulator page
- expiring-docs page
- privacy page
- terms page
- database.types
- production schema
- create demo accounts
- KioskScreen
- make overview doc
- make overview doc de
- make demo data
- seed team
- roster page
- CI CD
- BottomNav
- Project configuration
- production functions
- production functions
- production schema
- atomic workflows
- rotate passwords
- make feature doc
- reproduce bugs
- dev config
- service worker
- summary page
- compliance
- owner
- PURGE PII FROM HISTORY
- tsconfig.agentcheck
- ScanToCount
- 03 user pay step a
- INVENTORY UX PROPOSAL
- package
- Project configuration
- checklist page
- directory page
- Project configuration
- production functions
- production schema
- sw
- schedule insights
- DESIGN
- BRANCHING
- MOBILE APP
- PUSH NOTIFICATIONS SETUP
- eslint.config
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
1. `useLang()` - 141 edges
2. `toast()` - 129 edges
3. `Icon()` - 128 edges
4. `createClient()` - 121 edges
5. `CardSkeleton()` - 94 edges
6. `react` - 84 edges
7. `next` - 65 edges
8. `berlinToday()` - 55 edges
9. `readAll()` - 40 edges
10. `AttendancePage()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `Either side scoped stock transfers` --conceptually_related_to--> `Per branch operational data`  [INFERRED]
  README.md → docs/PRD.md
- `Offline attendance replay` --conceptually_related_to--> `Server stamped attendance`  [INFERRED]
  README.md → docs/ARCHITECTURE.md
- `Feature to develop to main release flow` --conceptually_related_to--> `Blocking typecheck tests coverage and build`  [INFERRED]
  docs/RULES.md → .github/workflows/ci.yml
- `load()` --calls--> `getChecklistOversight()`  [EXTRACTED]
  src/app/(app)/checklist/page.tsx → src/lib/queries/operations.ts
- `useMyLocation()` --calls--> `toast()`  [EXTRACTED]
  src/app/(app)/geofence/page.tsx → src/components/Toast.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Read only assistant safety boundary** — docs_architecture_phase1_agent, docs_architecture_agent_tools, docs_architecture_caller_session [EXTRACTED 1.00]

## Communities (175 total, 67 thin omitted)

### Community 0 - "attendance page"
Cohesion: 0.06
Nodes (71): AttendancePage(), applyOptimistic(), breakEndAction(), breakStartAction(), clockInAction(), clockOutAction(), doAction(), getGeo() (+63 more)

### Community 1 - "attendance-hub page"
Cohesion: 0.06
Nodes (70): ApprovalsPage(), confirmReject(), decide(), load(), remove(), CORR_KEY, Filter, fmtD() (+62 more)

### Community 2 - "branch analytics"
Cohesion: 0.07
Nodes (63): eur(), eur(), input, LaborPage(), loadAll(), saveSale(), saveWage(), lbl (+55 more)

### Community 3 - "staff page"
Cohesion: 0.07
Nodes (45): Field(), input, primaryBtn, ProfilePage(), load(), save(), Row(), card (+37 more)

### Community 4 - "DocumentsSection"
Cohesion: 0.09
Nodes (43): archiveBtn, cancelBtn, DOC_TYPES, DocumentsSection(), archive(), load(), onFile(), view() (+35 more)

### Community 5 - "operations"
Cohesion: 0.11
Nodes (40): berlinTodayStr(), card, ChecklistStatusPage(), load(), input, card, CATEGORIES, Field() (+32 more)

### Community 6 - "cover"
Cohesion: 0.12
Nodes (37): CoverPage(), doCancel(), doClaim(), doDecide(), doRequest(), loadAll(), fmtDate(), fmtClock() (+29 more)

### Community 7 - "NotificationBell"
Cohesion: 0.09
Nodes (31): NOTIF, NotificationsPage(), load(), markRead(), card, input, primaryBtn, SettingsPage() (+23 more)

### Community 8 - "inventory page"
Cohesion: 0.16
Nodes (36): card, chip, fcColor(), Field(), input, InventoryPage(), doAddDelivery(), doAddProduct() (+28 more)

### Community 9 - "production functions"
Cohesion: 0.05
Nodes (20): announcements, app_config, attendance_corrections, attendance_events, audit_logs, auth_throttle, availability, branch_settings (+12 more)

### Community 10 - "compare page"
Cohesion: 0.10
Nodes (30): Chip(), ComparePage(), load(), fmtClock(), fmtDay(), fmtMins(), mondayOf(), navBtn (+22 more)

### Community 11 - "production schema"
Cohesion: 0.07
Nodes (9): app_config, auth_throttle, cover_requests_branch_status_idx, cover_requests_requester_idx, daily_sales, idx_checklist_branch, idx_incident_branch, inventory_purchases_branch_date_idx (+1 more)

### Community 12 - "rank"
Cohesion: 0.15
Nodes (21): @supabase/supabase-js, POST(), VALID_ROLES, WEAK_PASSWORDS, POST(), POST(), POST(), AssistantPage() (+13 more)

### Community 13 - "hours page"
Cohesion: 0.12
Nodes (20): react, AuditPage(), card, BranchDetailPage(), Stat(), card, HoursPage(), load() (+12 more)

### Community 14 - "availability"
Cohesion: 0.15
Nodes (21): AvailabilityPage(), save(), card, DAYS, primaryBtn, SHIFTS, card, input (+13 more)

### Community 15 - "index"
Cohesion: 0.20
Nodes (16): ChangePasswordForm(), inputStyle, ChangePasswordPage(), KioskPage(), LoginPage(), Ctx, LangCtx, LanguageProvider() (+8 more)

### Community 16 - "ThemeToggle"
Cohesion: 0.13
Nodes (9): next, AppLayout(), ManagementNav(), ThemeToggle(), toggle(), ToastHost(), ViewToggle(), getViewMode() (+1 more)

### Community 17 - "export page"
Cohesion: 0.16
Nodes (21): fmtDate(), PayrollExportPage(), dl(), downloadCsv(), downloadExcel(), matrix(), payrollReport(), saveRules() (+13 more)

### Community 18 - "waste"
Cohesion: 0.25
Nodes (22): eur(), fmtWhen(), REASON_EMOJI, REASONS, WastePage(), loadAll(), remove(), submit() (+14 more)

### Community 19 - "analytics page"
Cohesion: 0.17
Nodes (18): AnalyticsPage(), ChartCard(), Kpi(), Period, TEAM_COLORS, tooltip, CompliancePage(), ICON (+10 more)

### Community 20 - "leave balance"
Cohesion: 0.20
Nodes (20): backLink, fmtH(), Row(), StaffDetailPage(), saveAllowance(), Stat(), bwHolidays(), computeBalance() (+12 more)

### Community 21 - "production schema"
Cohesion: 0.15
Nodes (21): announcements, attendance_corrections, attendance_events, attendance_logs, audit_logs, availability, branch_settings, branches (+13 more)

### Community 22 - "transfer"
Cohesion: 0.28
Nodes (20): fmtWhen(), TransfersPage(), act(), loadAll(), resetForm(), submit(), admin(), branchNames() (+12 more)

### Community 23 - "main"
Cohesion: 0.19
Nodes (18): Terraform module: infra/terraform, google_artifact_registry_repository.repo, google_cloud_run_v2_service.web, google_project_service.svc, google_secret_manager_secret_iam_member.svc_role_access, google_secret_manager_secret_iam_member.vapid_access, google_secret_manager_secret.svc_role, google_secret_manager_secret.vapid_private (+10 more)

### Community 24 - "sentryScrub"
Cohesion: 0.18
Nodes (12): csp, nextConfig, supabaseHost, @sentry/nextjs, onRouterTransitionStart, onRequestError, register(), isSensitiveKey() (+4 more)

### Community 25 - "announcements page"
Cohesion: 0.23
Nodes (18): AnnouncementsPage(), del(), load(), pin(), post(), card, CAT_COLORS, CATEGORIES (+10 more)

### Community 26 - "leave page"
Cohesion: 0.18
Nodes (18): card, Field(), input, LeavePage(), loadMine(), submit(), primaryBtn, TabBtn() (+10 more)

### Community 27 - "package"
Cohesion: 0.11
Nodes (18): name, private, version, @anthropic-ai/sdk, @capacitor/android, @capacitor/core, lucide-react, qrcode (+10 more)

### Community 28 - "package"
Cohesion: 0.11
Nodes (19): dependencies, @anthropic-ai/sdk, @capacitor/android, @capacitor/cli, @capacitor/core, docx, html5-qrcode, lucide-react (+11 more)

### Community 29 - "(app) page"
Cohesion: 0.23
Nodes (16): HubLink(), MyDayPage(), DashboardStat(), fmtH(), HomePage(), ManagerDash(), OrgOverview, OwnerDash() (+8 more)

### Community 30 - "schedule page"
Cohesion: 0.20
Nodes (16): DAYS, Field(), navBtn, primaryBtn, SchedulePage(), changeWeek(), doSubmitSwap(), loadShifts() (+8 more)

### Community 31 - "tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 32 - "CONTINUE HERE"
Cohesion: 0.11
Nodes (12): Database contact privacy deferred, Historical operational handoff, Three-strike login lock requires manager unblock, Multi-branch ownership aggregation deferred, VAPID deployment variables and phone verification required, Shared seed credential rotation explicitly deferred, Historical production readiness audit, Database RLS and definer functions carry security boundaries (+4 more)

### Community 33 - "schedule-hub page"
Cohesion: 0.21
Nodes (16): presetsFor(), RosterPage(), addEntry(), changeWeek(), doSave(), load(), BarRow(), Mini() (+8 more)

### Community 34 - "temp page"
Cohesion: 0.31
Nodes (16): fmtWhen(), KINDS, TempPage(), doAddUnit(), doLog(), doRemoveUnit(), loadCore(), loadHistory() (+8 more)

### Community 35 - "dashboard"
Cohesion: 0.12
Nodes (14): assert, exportsForCheck, fs, hq, owner, path, props, React (+6 more)

### Community 36 - "inventory"
Cohesion: 0.12
Nodes (15): assert, count, counts, exported, forecast, fs, names, path (+7 more)

### Community 37 - "shift conflicts"
Cohesion: 0.21
Nodes (13): ActionCenterPage(), ConflictsPage(), getActionCenter(), getStaffAlerts(), MGR, OWNER, addDays(), getShiftConflicts() (+5 more)

### Community 38 - "branches page"
Cohesion: 0.21
Nodes (11): BranchesPage(), Mini(), Total(), SearchPage(), AgentChat(), Msg, AgentWidget(), RobotIcon() (+3 more)

### Community 39 - "expiry"
Cohesion: 0.35
Nodes (15): ExpiryPage(), discard(), loadAll(), resetForm(), submit(), used(), fmtDate(), addBatch() (+7 more)

### Community 40 - "production functions"
Cohesion: 0.12
Nodes (14): idx_clock_overrides_user, public.audit_user_document(), public.clock_code_batch(), public.clock_code_for(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token() (+6 more)

### Community 42 - "geofence"
Cohesion: 0.30
Nodes (14): GeofencePage(), doGrant(), load(), save(), useMyLocation(), Staff, GeofenceMode, getGeofence() (+6 more)

### Community 43 - "ARCHITECTURE"
Cohesion: 0.13
Nodes (10): accessible_branch_ids SQL helper, Stock expiry and waste read tools, Agent tools use caller RLS session, Next.js 16 App Router, Flag gated read only AI assistant, Separate schnitzery ops agent framework, Supabase Postgres Auth and RLS, Six tier role hierarchy (+2 more)

### Community 44 - "kiosks page"
Cohesion: 0.35
Nodes (12): btn, KiosksPage(), add(), load(), saveName(), toggle(), createKiosk(), getMe() (+4 more)

### Community 45 - "package"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/qrcode, @types/react (+5 more)

### Community 46 - "layout"
Cohesion: 0.15
Nodes (12): react-dom, assert, exported, fs, layout, path, React, { renderToStaticMarkup } (+4 more)

### Community 47 - "inventory data"
Cohesion: 0.18
Nodes (12): allRows, assert, count(), exportsObject, fs, key(), master(), require() (+4 more)

### Community 48 - "route"
Cohesion: 0.29
Nodes (9): plusDaysISO(), POST(), runTool(), Sb, SYSTEM(), TOOLS, validateToolInput(), validChatMessages() (+1 more)

### Community 49 - "loginThrottle"
Cohesion: 0.44
Nodes (11): inputStyle, LoginForm(), handleLogin(), admin(), checkLogin(), clientIpKey(), countSince(), finishLogin() (+3 more)

### Community 50 - "production schema"
Cohesion: 0.15
Nodes (12): public.audit_user_document(), public.clock_code_batch(), public.clock_token_batch(), public.current_branch(), public.current_clock_code(), public.current_clock_token(), public."current_role"(), public.grant_clock_override() (+4 more)

### Community 52 - "order page"
Cohesion: 0.32
Nodes (9): eur(), OrderPage(), copyGroup(), emailGroup(), groupText(), load(), printAll(), today() (+1 more)

### Community 53 - "analytics"
Cohesion: 0.32
Nodes (9): DOW, getAnalytics(), getMgr(), isManager(), toH(), berlinMonday(), berlinMonth(), berlinWeekdayIndex() (+1 more)

### Community 54 - "Charts"
Cohesion: 0.42
Nodes (10): recharts, DonutStat(), Legend(), MiniBars(), ProgressRing(), RankBars(), tip(), Tone (+2 more)

### Community 55 - "layout"
Cohesion: 0.25
Nodes (6): @vercel/analytics, metadata, RootLayout(), viewport, CookieNotice(), PWARegister()

### Community 56 - "simulator page"
Cohesion: 0.25
Nodes (7): ClockDisplayPage(), fetchCode(), eur(), pct(), SimulatorPage(), MAP, getCurrentClockCode()

### Community 57 - "expiring-docs page"
Cohesion: 0.25
Nodes (9): Bucket, DOC_TYPE_KEYS, EmptyOk(), ExpiringDocsPage(), fmtDate(), rowLink(), sel, statusInfo() (+1 more)

### Community 58 - "privacy page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, PrivacyPage(), Section() (+2 more)

### Community 59 - "terms page"
Cohesion: 0.20
Nodes (10): a, h1, h2, metadata, muted, p, Section(), TermsPage() (+2 more)

### Community 60 - "database.types"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 61 - "production schema"
Cohesion: 0.18
Nodes (6): idx_branches_franchise, idx_clock_overrides_user, public.clock_code_for(), public.clock_out(), public.clock_token_sig(), public.resolve_kiosk()

### Community 62 - "create demo accounts"
Cohesion: 0.24
Nodes (6): ACCOUNTS, admin, ensureAuthUser(), env, resolveBranch(), run()

### Community 63 - "KioskScreen"
Cohesion: 0.31
Nodes (8): qrcode.react, Batch, getKioskId(), KioskScreen(), refreshBatch(), saveBatch(), tick(), getClockTokenBatch()

### Community 64 - "make overview doc"
Cohesion: 0.33
Nodes (8): benefit(), bwhy(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 65 - "make overview doc de"
Cohesion: 0.33
Nodes (8): benefit(), bullet(), doc, h2(), pillars(), roleTitle(), roleWho(), t()

### Community 66 - "make demo data"
Cohesion: 0.29
Nodes (8): admin, ANNOUNCEMENTS, berlinToday(), clean(), env, firstBranch(), ITEMS, seed()

### Community 67 - "seed team"
Cohesion: 0.27
Nodes (8): admin, env, makePassword(), PREFIX, readRoster(), run(), slug(), VALID_ROLES

### Community 68 - "roster page"
Cohesion: 0.20
Nodes (9): DAYS, Entry, miniLbl, miniSelect, navBtn, primaryBtn, Roster, TEAM_COLORS (+1 more)

### Community 69 - "CI CD"
Cohesion: 0.22
Nodes (6): Lint and dependency audit advisory, Typecheck tests build block CI gate, Deferred Cloud Run deployment with workload identity, Continuous integration and deployment guidance, Vercel Git integration handles deployment, Infrastructure deployment options

### Community 70 - "BottomNav"
Cohesion: 0.42
Nodes (8): BottomNav(), BoxIcon(), BuildingIcon(), CalIcon(), ClockIcon(), GridIcon(), HomeIcon(), UserIcon()

### Community 71 - "Project configuration"
Cohesion: 0.28
Nodes (3): public.current_clock_code(), public.guard_users_sensitive_update(), public.sync_attendance_events()

### Community 72 - "production functions"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 73 - "production functions"
Cohesion: 0.22
Nodes (6): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.clock_token_sig(), public.notification_sweep(), public.resolve_kiosk()

### Community 74 - "production schema"
Cohesion: 0.22
Nodes (8): idx_att_branch_date, idx_att_user_date, idx_attendance_branch, idx_attendance_date, idx_attendance_user, public.decide_attendance_correction(), public.end_break(), public.start_break()

### Community 75 - "atomic workflows"
Cohesion: 0.25
Nodes (4): assert, fs, path, { PGlite }

### Community 76 - "rotate passwords"
Cohesion: 0.29
Nodes (5): admin, APPLY, env, makePassword(), run()

### Community 77 - "make feature doc"
Cohesion: 0.36
Nodes (6): docx, bullet(), doc, heading(), section(), sub()

### Community 78 - "reproduce bugs"
Cohesion: 0.25
Nodes (5): typescript, assert, fs, ts, vm

### Community 79 - "dev config"
Cohesion: 0.25
Nodes (6): assert, fs, path, source, ts, vm

### Community 80 - "service worker"
Cohesion: 0.25
Nodes (5): assert, fs, handlers, path, vm

### Community 81 - "summary page"
Cohesion: 0.39
Nodes (7): csvCell(), eur(), Kpi(), lastMonths(), SummaryPage(), downloadCsv(), load()

### Community 82 - "compliance"
Cohesion: 0.46
Nodes (7): breakMinutes(), dlabel(), getCompliance(), getMgr(), h1(), isManager(), parseBreaks()

### Community 83 - "owner"
Cohesion: 0.57
Nodes (7): emptyTotals(), getBranchDetail(), getBranchStats(), getMe(), getMyBranches(), isOwner(), todayStr()

### Community 84 - "PURGE PII FROM HISTORY"
Cohesion: 0.29
Nodes (5): Employee data exposure incident, History purge, credential rotation and access review documented pending, Historical public employee roster exposure, Unique credential rotation after published shared password, Employee data history purge runbook

### Community 85 - "tsconfig.agentcheck"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, noEmit, skipLibCheck, extends, include

### Community 86 - "ScanToCount"
Cohesion: 0.52
Nodes (7): ScanToCount(), close(), onDecode(), save(), scanNext(), startScanner(), stopScanner()

### Community 87 - "03 user pay step a"
Cohesion: 0.43
Nodes (4): idx_user_pay_branch, public.user_in_my_branches(), public.user_pay, trg_sync_user_pay_branch

### Community 88 - "INVENTORY UX PROPOSAL"
Cohesion: 0.33
Nodes (6): Improve existing portal instead of separate prototype, Purchases divided by sales is not consumption food cost, Mailto opens client and does not prove supplier submission, Missing prices require partial order estimates, Route backed inventory workflow navigation, Separate unknown stale failed and healthy stock states

### Community 89 - "package"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 90 - "Project configuration"
Cohesion: 0.40
Nodes (3): idx_branches_franchise, public.clock_out(), public.sync_attendance_events()

### Community 91 - "checklist page"
Cohesion: 0.40
Nodes (5): berlinTodayStr(), card, ChecklistStatusPage(), load(), input

### Community 92 - "directory page"
Cohesion: 0.40
Nodes (5): card, DirectoryPage(), iconBtn, TEAM_COLORS, getDirectory()

### Community 94 - "production functions"
Cohesion: 0.33
Nodes (4): attendance_logs, branches, franchises, payroll_runs

### Community 95 - "production schema"
Cohesion: 0.33
Nodes (4): idx_att_events_action, idx_att_events_branch, idx_att_events_user, public.notification_sweep()

### Community 97 - "schedule insights"
Cohesion: 0.60
Nodes (4): DAYS, getMe(), getScheduleOverview(), isManager()

### Community 100 - "DESIGN"
Cohesion: 0.50
Nodes (3): Staff focused mobile bottom navigation, Management sidebar and collapsible mobile menu, Light desktop management workspace

### Community 101 - "BRANCHING"
Cohesion: 0.50
Nodes (4): Develop branch integration preview, Main branch triggers Vercel production, Feature to develop to main release flow, Branch protection requires CI gate and gitleaks

### Community 102 - "MOBILE APP"
Cohesion: 0.50
Nodes (3): Capacitor hybrid mobile deployment guide, Native plugin icon and splash changes require rebuild, Web deploy updates shell without native rebuild

### Community 103 - "PUSH NOTIFICATIONS SETUP"
Cohesion: 0.50
Nodes (3): Phone background delivery and tap routing acceptance test, Push notification setup runbook, VAPID keys identify browser push sender

### Community 104 - "eslint.config"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 106 - "README"
Cohesion: 0.50
Nodes (3): FIFO discard feeds waste log, Depletion forecast and reorder suggestions, Waste valued from delivery history

### Community 111 - "production functions"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 112 - "production functions"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 113 - "production functions"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 114 - "production schema"
Cohesion: 0.50
Nodes (3): idx_avail_branch, idx_avail_branch_week, idx_avail_user_week

### Community 115 - "production schema"
Cohesion: 0.50
Nodes (3): idx_corrections_branch, idx_corrections_user, trg_correction_submitted

### Community 116 - "production schema"
Cohesion: 0.50
Nodes (3): idx_inv_counts_branch, idx_inv_counts_date, idx_inv_counts_prod

### Community 117 - "ci"
Cohesion: 0.67
Nodes (3): Lint and dependency audit advisory, Blocking typecheck tests coverage and build, Feature to develop to main release flow

### Community 121 - "ROADMAP"
Cohesion: 0.67
Nodes (3): Approval state machine draft through succeeded, Deferred background proposals approvals and tracing, Writes require approval and limited database role

## Knowledge Gaps
- **458 isolated node(s):** `config`, `eslintConfig`, `var.image`, `supabaseHost`, `csp` (+453 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 654 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **67 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `hours page` to `attendance page`, `attendance-hub page`, `branch analytics`, `staff page`, `DocumentsSection`, `operations`, `cover`, `NotificationBell`, `inventory page`, `compare page`, `availability`, `index`, `ThemeToggle`, `export page`, `waste`, `analytics page`, `leave balance`, `transfer`, `sentryScrub`, `announcements page`, `leave page`, `package`, `(app) page`, `schedule page`, `schedule-hub page`, `temp page`, `dashboard`, `inventory`, `shift conflicts`, `branches page`, `expiry`, `geofence`, `kiosks page`, `layout`, `loginThrottle`, `order page`, `Charts`, `layout`, `simulator page`, `expiring-docs page`, `KioskScreen`, `roster page`, `summary page`, `checklist page`, `directory page`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `useLang()` connect `branches page` to `attendance page`, `attendance-hub page`, `branch analytics`, `staff page`, `DocumentsSection`, `operations`, `cover`, `NotificationBell`, `inventory page`, `compare page`, `hours page`, `availability`, `index`, `ThemeToggle`, `export page`, `waste`, `analytics page`, `leave balance`, `transfer`, `announcements page`, `leave page`, `(app) page`, `schedule page`, `schedule-hub page`, `temp page`, `shift conflicts`, `expiry`, `geofence`, `kiosks page`, `loginThrottle`, `order page`, `simulator page`, `expiring-docs page`, `KioskScreen`, `roster page`, `BottomNav`, `summary page`, `ScanToCount`, `checklist page`, `directory page`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `next` connect `ThemeToggle` to `attendance page`, `attendance-hub page`, `branch analytics`, `staff page`, `cover`, `NotificationBell`, `inventory page`, `compare page`, `rank`, `hours page`, `index`, `analytics page`, `leave balance`, `sentryScrub`, `package`, `(app) page`, `schedule page`, `schedule-hub page`, `shift conflicts`, `branches page`, `geofence`, `kiosks page`, `route`, `loginThrottle`, `order page`, `layout`, `simulator page`, `expiring-docs page`, `privacy page`, `terms page`, `BottomNav`, `summary page`, `proxy`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `config`, `eslintConfig`, `var.image` to the rest of the system?**
  _458 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `attendance page` be split into smaller, more focused modules?**
  _Cohesion score 0.05975485188968335 - nodes in this community are weakly interconnected._
- **Should `attendance-hub page` be split into smaller, more focused modules?**
  _Cohesion score 0.05809979494190021 - nodes in this community are weakly interconnected._
- **Should `branch analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.07298245614035087 - nodes in this community are weakly interconnected._

Scope note: 231 code files were structurally scanned. Documentation fragments retain the 28-file semantic snapshot from 2026-10-10; newly added documentation is not semantically indexed by this structural refresh. Generated images are excluded. See SOURCE_COVERAGE.json, CODE_AUDIT.md and docs/BUGFIXES.md.

Cost note: structural extraction uses no LLM tokens. Host-agent documentation token usage is unavailable; zero counters do not mean zero usage.
