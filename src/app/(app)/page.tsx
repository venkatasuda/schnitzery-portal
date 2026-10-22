import { createClient } from "@/lib/supabase/server";
import { getOrgOverview } from "@/lib/queries/org-overview";
import { getDashboardStats } from "@/lib/queries/admin";
import { getMyHours } from "@/lib/queries/timepay";
import { getMyStatus } from "@/lib/queries/attendance";
import { getLiveAttendance, getMonthlyOvertime } from "@/lib/queries/live-attendance";
import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import { getLaborSummary } from "@/lib/queries/labor";
import { listMyDocuments } from "@/lib/queries/documents";
import { getViewMode } from "@/lib/viewMode";
import Link from "next/link";
import StatusStrip from "@/components/StatusStrip";
import Icon from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import { ProgressRing, MiniBars, RankBars } from "@/components/dash/Charts";
import { getWasteTrends, getWasteByBranch } from "@/lib/queries/waste";
import { Stat } from "@/components/ui";

type OrgOverview = Extract<Awaited<ReturnType<typeof getOrgOverview>>, { ok: true }>;
type Tf = (k: string, v?: Record<string, string | number>) => string;

const fmtH = (mins: number) => `${Math.floor((mins || 0) / 60)}h ${String((mins || 0) % 60).padStart(2, "0")}m`;

// Role-based home dashboard. Managers get a full operational dashboard;
// staff and owners keep their focused views.
export default async function HomePage() {
  const t = await getT();
  const docLabel = (k: string) => t("documents.type_" + (["id_card", "visa", "work_permit", "contract", "certificate"].includes(k) ? k : "other"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string | null; team: string | null; avatar_url: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("users").select("full_name, role, team, avatar_url").eq("id", user.id).single();
    profile = data;
  }
  const role = profile?.role || "staff";
  const isManager = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role);
  const isHQrole = ["brand_owner", "super_admin"].includes(role); // brand owner / super admin
  const isBranchOwner = role === "branch_owner"; // owns one branch: manager toolkit + analytics + branch admin

  // Brand owners choose HQ oversight or the single-branch toolkit (see viewMode.ts).
  const viewMode = await getViewMode();
  const hqBranchMode = isHQrole && viewMode === "branch"; // brand owner acting on their branch
  const isHQ = isHQrole && !hqBranchMode;                 // true HQ oversight home
  const firstName = (profile?.full_name || "there").split(" ")[0];

  const hour = new Date().getHours();
  const greeting = hour < 5 ? t("greeting.evening") : hour < 12 ? t("greeting.morning") : hour < 18 ? t("greeting.afternoon") : t("greeting.evening");

  // ── data ──
  let staffHours: { totalHours: number; shifts: number; targetHours: number | null } | null = null;
  let staffClockedIn = false, staffOnBreak = false;
  let org: OrgOverview | null = null;
  let mOps: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;
  let mLive: { workingNow: number; completed: number; late: number; totalMins: number } | null = null;
  let mOt: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null = null;
  let mSched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null = null;
  let mCost: { laborPct: number | null; foodCostPct: number | null; monthSales?: number; laborCost?: number; invSpend?: number; missingWageStaff?: number; coverage?: Record<"sales" | "labor" | "spend", { complete: boolean; missing: Record<string, number> }> } | null = null;
  let mWaste: { label: string; value: number }[] = [];
  let hqWaste: { label: string; value: number }[] = [];

  // kick off the document check now so it runs in parallel with the role queries
  const docsP = listMyDocuments();

  if (isHQ) {
    const [d, wRes] = await Promise.all([getOrgOverview(), getWasteByBranch(30).catch(() => ({ ok: false }))]);
    if (d.ok) org = d;
    if ((wRes as any).ok) hqWaste = ((wRes as any).rows || []).filter((r: any) => r.value > 0).map((r: any) => ({ label: r.name, value: r.value })).slice(0, 8);
  } else if (isManager) {
    const [dRes, liveRes, otRes, schedRes, stRes, cRes, wRes] = await Promise.all([
      getDashboardStats(), getLiveAttendance(), getMonthlyOvertime(), getScheduleOverview(), getMyStatus(), getLaborSummary(), getWasteTrends(6).catch(() => ({ ok: false })),
    ]);
    if ((cRes as any).ok) mCost = cRes as any;
    if ((wRes as any).ok) mWaste = ((wRes as any).weeks || []).map((w: any) => ({ label: String(w.weekStart).slice(5), value: w.wasteValue }));
    if (stRes.ok) { staffClockedIn = stRes.clockedIn || false; staffOnBreak = stRes.onBreak || false; }
    if (dRes.ok) mOps = dRes.stats ?? null;
    if (liveRes.ok) mLive = { workingNow: liveRes.workingNow || 0, completed: liveRes.completed || 0, late: liveRes.late || 0, totalMins: liveRes.totalMins || 0 };
    if (otRes.ok) mOt = { totalWorkedMins: otRes.totalWorkedMins || 0, totalOvertimeMins: otRes.totalOvertimeMins || 0, peopleOver: otRes.peopleOver || 0 };
    if (schedRes.ok) mSched = { submissionCount: schedRes.submissionCount || 0, staffCount: schedRes.staffCount || 0, rosterExists: schedRes.rosterExists || false };
  } else {
    const [h, st] = await Promise.all([getMyHours(), getMyStatus()]);
    if (h.ok) staffHours = { totalHours: h.totalHours || 0, shifts: h.shifts || 0, targetHours: h.targetHours ?? null };
    if (st.ok) { staffClockedIn = st.clockedIn || false; staffOnBreak = st.onBreak || false; }
  }

  // the logged-in user's own documents expiring within 60 days (any role)
  const myExpiring: { label: string; days: number }[] = [];
  const docsRes = await docsP;
  if (docsRes.ok) {
    for (const d of docsRes.docs || []) {
      if (!d.expiry_date) continue;
      // Only the CURRENT approved version of each doc type can expire. Superseded,
      // rejected and archived versions kept for history must not raise an alarm.
      if (!d.is_active || d.status !== "approved") continue;
      const days = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / 86400000);
      if (days <= 60) myExpiring.push({ label: docLabel(d.doc_type), days });
    }
    myExpiring.sort((a, b) => a.days - b.days);
  }

  return (
    <div className="fade-up">
      {isManager ? <div className="dashboard-page-heading"><div><h1>{t("workspace.dashboard")}</h1><p>{greeting}, {firstName} · {t("roles." + role)}</p></div><Link href={isHQ ? "/overview" : "/ops"} className="btn-secondary">{isHQ ? t("org.title") : t("home.dailyOps")} <Icon e="↗" size={16} /></Link></div> : <div className="profile-pill">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`avatar${isManager ? " mgr" : ""}`} src={profile.avatar_url} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div className={`avatar${isManager ? " mgr" : ""}`}>{(profile?.full_name || "?")[0].toUpperCase()}</div>
        )}
        <div>
          <div className="profile-name">{greeting}, {firstName}<span className="mgr-badge">{t("roles." + role)}</span></div>
          <div className="profile-sub">{profile?.team || t("roles." + role)} · Schnitzery Stuttgart</div>
        </div>
      </div>

      }

      {myExpiring.length > 0 && (
        <div className="card" style={{ borderColor: "rgba(231,76,60,0.4)", background: "rgba(231,76,60,0.08)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "var(--danger)", fontSize: 14, marginBottom: 4 }}>
            <Icon e="⚠" size={15} color="var(--danger)" /> {t("home.docsNeedAttention")}
          </div>
          {myExpiring.slice(0, 3).map((e, i) => (
            <div className="t-sm u-text mt-h" key={i}>
              {e.days < 0 ? t("home.docExpired", { doc: e.label, days: Math.abs(e.days) }) : e.days === 0 ? t("home.docToday", { doc: e.label }) : t("home.docSoon", { doc: e.label, days: e.days })}
            </div>
          ))}
          <Link href="/profile" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none", display: "inline-block", marginTop: 8 }}>{t("home.updateInProfile")} ›</Link>
        </div>
      )}

      {isManager && <StatusStrip />}

      {isHQ ? (
        <OwnerDash t={t} data={org} waste={hqWaste} />
      ) : isManager ? (
        <ManagerDash ops={mOps} live={mLive} ot={mOt} sched={mSched} clockedIn={staffClockedIn} onBreak={staffOnBreak} owner={isBranchOwner || hqBranchMode} cost={mCost} waste={mWaste} t={t} />
      ) : (
        <StaffDash hours={staffHours} clockedIn={staffClockedIn} onBreak={staffOnBreak} t={t} />
      )}
    </div>
  );
}

// ─────────── STAFF DASHBOARD ───────────
function StaffDash({ hours, clockedIn, onBreak, t }: {
  hours: { totalHours: number; shifts: number; targetHours: number | null } | null;
  clockedIn: boolean; onBreak: boolean; t: Tf;
}) {
  const clockTitle = onBreak ? t("home.clockOnBreak") : clockedIn ? t("home.clockWorking") : t("home.clockInOut");
  const clockSub = onBreak ? t("home.clockSubBreak") : clockedIn ? t("home.clockSubWorking") : t("home.clockSubIdle");
  const target = hours?.targetHours ?? null;
  const pct = target && target > 0 ? Math.min(100, Math.round(((hours?.totalHours || 0) / target) * 100)) : 0;

  return (
    <>
      <Link href="/attendance" className="feature-card" style={{ background: clockedIn ? "var(--success-soft)" : "var(--dark)" }}>
        <div className="feature-icon" style={{ background: "var(--accent-soft)" }}><Icon e="🕐" size={22} color="var(--gold-ink)" /></div>
        <div className="u-flex1">
          <div className="feature-title">{clockTitle}</div>
          <div className="feature-sub">{clockSub}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, margin: "4px 0 14px", padding: 16 }}>
        {target != null && <ProgressRing pct={pct} label={t("home.ofTarget")} tone={pct >= 80 ? "green" : "gold"} size={108} />}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <Stat value={`${hours?.totalHours ?? 0}h`} label={t("home.thisMonthStat")} color="var(--gold-ink)" />
          <Stat value={hours?.shifts ?? 0} label={t("nav.shifts")} />
          {target == null && <Stat value="—" label={t("home.ofTarget")} />}
        </div>
      </div>

      <div className="section-label">{t("home.workplace")}</div>
      <Shortcut href="/announcements" icon="📣" title={t("home.announcements")} sub={t("home.announcementsSub")} />
      <Shortcut href="/incidents" icon="🚨" title={t("home.reportIncident")} sub={t("home.reportIncidentSub")} />
      <Shortcut href="/temp" icon="🌡️" title={t("home.tempLog")} sub={t("home.tempLogSub")} />
      <Shortcut href="/waste" icon="🗑️" title={t("home.wasteLog")} sub={t("home.wasteLogSub")} />
      <Shortcut href="/expiry" icon="📅" title={t("home.expiry")} sub={t("home.expirySub")} />
    </>
  );
}

// ─────────── MANAGER DASHBOARD ───────────
function ManagerDash({ ops, live, ot, sched, clockedIn, onBreak, owner = false, cost, waste, t }: {
  ops: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null;
  live: { workingNow: number; completed: number; late: number; totalMins: number } | null;
  ot: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null;
  sched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null;
  clockedIn: boolean; onBreak: boolean; owner?: boolean; cost?: { laborPct: number | null; foodCostPct: number | null; monthSales?: number; laborCost?: number; invSpend?: number; missingWageStaff?: number; coverage?: Record<"sales" | "labor" | "spend", { complete: boolean; missing: Record<string, number> }> } | null; waste?: { label: string; value: number }[]; t: Tf;
}) {
  const missing = sched ? Math.max(0, sched.staffCount - sched.submissionCount) : 0;
  const alerts = [
    ...(ops?.openIncidents ? [{ href: "/incidents", icon: "🚨", text: t("home.openIncidents", { n: ops.openIncidents }), tone: "danger" }] : []),
    ...(ops?.pendingApprovals ? [{ href: "/approvals", icon: "✅", text: t("home.approvalsWaiting", { n: ops.pendingApprovals }), tone: "warn" }] : []),
    ...(ops?.lowStock ? [{ href: "/inventory", icon: "📦", text: t("home.lowStock", { n: ops.lowStock }), tone: "warn" }] : []),
    ...(missing ? [{ href: "/noshow", icon: "📋", text: t("home.notSubmitted", { n: missing }), tone: "warn" }] : []),
  ];
  return <div className="dashboard-layout">
    <div className="dashboard-kpis">
      <DashboardStat label={t("home.workingNow")} value={live?.workingNow ?? "—"} href="/attendance-hub" icon="👥" />
      <DashboardStat label={t("home.hours")} value={live ? fmtH(live.totalMins) : "—"} href="/ops" icon="🕐" />
      <DashboardStat label={t("home.approvals")} value={ops?.pendingApprovals ?? "—"} href="/approvals" icon="✅" />
      <DashboardStat label={t("homeDashboard.lowStock")} value={ops?.lowStock ?? "—"} href="/inventory" icon="📦" />
    </div>
    <div className="dashboard-main-grid">
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("home.needsAttention")}</h2><Link href="/action">{t("homeDashboard.reviewAll")} ›</Link></div>
        {!ops || !sched ? <p className="dashboard-muted">{t("homeDashboard.unavailable")}</p> : null}
        {alerts.map((a) => <Link href={a.href} key={a.href} className="dashboard-attention-row"><span className={`dashboard-status-icon ${a.tone}`}><Icon e={a.icon} size={18} /></span><span>{a.text}</span><Icon e="›" size={18} /></Link>)}
        {ops && sched && alerts.length === 0 && <div className="dashboard-empty"><Icon e="✅" size={24} color="var(--success)" /><div><strong>{t("home.allClear")}</strong><p>{t("home.allClearSub")}</p></div></div>}
        <div className="dashboard-section-footer"><span>{t("home.dailyChecklist")}</span><Link href={owner ? "/checklist-status" : "/checklist"}>{ops && ops.checklistTotal > 0 ? `${ops.checklistDone} / ${ops.checklistTotal}` : "—"} ›</Link></div>
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("nav.schedule")}</h2><Icon e="📅" size={20} color="var(--gold-ink)" /></div>
        <span className={`status-badge${sched?.rosterExists ? " good" : ""}`}>{sched ? sched.rosterExists ? t("homeDashboard.rosterReady") : t("homeDashboard.rosterOpen") : t("homeDashboard.unavailable")}</span>
        <p className="dashboard-muted">{sched ? t("home.availSubmitted", { a: sched.submissionCount, b: sched.staffCount }) : "—"}</p>
        <Link href="/schedule-hub" className="btn-gold dashboard-primary">{t("home.weeklyRoster")} <Icon e="→" size={16} /></Link>
        {!owner && <Link href="/attendance" className="dashboard-clock"><Icon e="🕐" size={18} /><span>{onBreak ? t("home.clockOnBreak") : clockedIn ? t("home.clockWorking") : t("home.clockInOut")}</span><Icon e="›" size={16} /></Link>}
      </section>
    </div>
    <div className="dashboard-detail-grid">
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("business.overview")}</h2><Link href="/analytics">{t("homeDashboard.details")} ›</Link></div>
        <div className="dashboard-costs">
          <div><span>{t("business.sales")}</span><strong>{cost?.monthSales == null || (cost.coverage?.sales.complete === false && !cost.monthSales) ? "—" : `${cost.coverage?.sales.complete === false ? "≥ " : ""}€${cost.monthSales.toLocaleString()}`}</strong></div>
          <div><span>{t("business.purchases")}</span><strong>{cost?.invSpend == null || (cost.coverage?.spend.complete === false && !cost.invSpend) ? "—" : `${cost.coverage?.spend.complete === false ? "≥ " : ""}€${cost.invSpend.toLocaleString()}`}</strong></div>
        </div>
        <div className="dashboard-facts">
          <div><span>{t("home.laborPct")}</span><strong>{cost?.laborPct == null ? "—" : `${cost.laborPct}%`}</strong></div>
          <div><span>{t("home.foodCostPct")}</span><strong>{cost?.foodCostPct == null ? "—" : `${cost.foodCostPct}%`}</strong></div>
        </div>
        <p className="dashboard-muted">{[cost?.missingWageStaff ? t("business.missingWages", { n: cost.missingWageStaff }) : "", cost?.coverage?.sales.missing.salesDays ? t("business.missingSalesDays", { n: cost.coverage.sales.missing.salesDays }) : "", cost?.coverage?.spend.missing.costs ? t("business.missingCosts", { n: cost.coverage.spend.missing.costs }) : ""].filter(Boolean).join(" · ") || t("business.purchaseNote")}</p>
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("home.wasteTrend")}</h2><Link href="/waste">{t("homeDashboard.details")} ›</Link></div>
        {waste && waste.some((w) => w.value > 0) ? <MiniBars data={waste} tone="blue" unit="€" /> : <div className="dashboard-empty"><Icon e="📊" size={24} /><p>{t("homeDashboard.noWasteTrend")}</p></div>}
        <div className="dashboard-section-footer"><span>{t("home.today")}</span><span>{t("home.statDone")}: {live?.completed ?? "—"} · {t("home.statLate")}: {live?.late ?? "—"}</span></div>
      </section>
    </div>
    <section className="dashboard-workflows">
      <h2>{t("homeDashboard.workflows")}</h2>
      <div className="dashboard-tools">
        <Shortcut href="/summary" icon="📄" title={t("home.monthlySummary")} sub={t("home.monthlySummarySub")} />
        <Shortcut href="/temp" icon="🌡️" title={t("home.tempLog")} sub={t("home.tempLogSubMgr")} />
        <Shortcut href="/incidents" icon="🚨" title={t("home.reportIncident")} sub={t("home.reportIncidentSubMgr")} />
        <Shortcut href="/announcements" icon="📣" title={t("home.postAnnouncement")} sub={t("home.postAnnouncementSub")} />
      </div>
    </section>
  </div>;
}

function DashboardStat({ label, value, href, icon }: { label: string; value: string | number; href: string; icon: string }) {
  return <Link href={href} className="dashboard-kpi"><div><span>{label}</span><Icon e={icon} size={18} /></div><strong>{value}</strong></Link>;
}

// ─────────── OWNER DASHBOARD (HQ oversight only) ───────────
// Cross-branch view for a brand owner. Deliberately contains NO single-branch
// shop-floor tools (roster, temp log, waste log, food expiry, inventory,
// transfers) — those live in the branch view, reachable via the HQ/Branch
// toggle in the header. Keeping this screen to oversight is the whole point of
// the split; see src/lib/viewMode.ts.
function OwnerDash({ t, data, waste }: { t: Tf; data: OrgOverview | null; waste?: { label: string; value: number }[] }) {
  return <div className="dashboard-layout">
    <div className="dashboard-kpis">
      <DashboardStat label={t("org.branches")} value={data?.totals.branches ?? "—"} href="/branches" icon="🏢" />
      <DashboardStat label={t("org.employees")} value={data?.totals.employees ?? "—"} href="/people-hub" icon="👥" />
      <DashboardStat label={t("org.workingNow")} value={data?.totals.workingNow ?? "—"} href="/overview" icon="🕐" />
      <DashboardStat label={t("org.issues")} value={data?.totals.issues ?? "—"} href="/overview" icon="⚠" />
    </div>
    <div className="dashboard-main-grid">
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("home.allBranches")}</h2><Link href="/overview">{t("homeDashboard.reviewAll")} ›</Link></div>
        {data ? <div className="table-scroll" tabIndex={0} role="region" aria-label={t("home.allBranches")}><table className="data-table"><thead><tr><th scope="col">{t("org.colBranch")}</th><th scope="col" className="numeric">{t("org.workingNow")}</th><th scope="col" className="numeric">{t("org.colAttendance")}</th></tr></thead><tbody>{data.ranking.slice(0, 6).map((branch) => <tr key={branch.id}><td><Link href={`/branches/${branch.id}`}>{branch.name}</Link></td><td className="numeric">{branch.workingNow}</td><td className="numeric">{branch.attendanceRate == null ? "—" : `${branch.attendanceRate}%`}</td></tr>)}</tbody></table></div> : <p className="dashboard-muted">{t("homeDashboard.unavailable")}</p>}
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><h2>{t("home.needsAttention")}</h2><Icon e="⚠" size={18} /></div>
        <div className="dashboard-facts">
          <div><span>{t("org.expiringDocs")}</span><Link href="/expiring-docs">{data?.expiringDocs ?? "—"} ›</Link></div>
          <div><span>{t("org.payrollStatus")}</span><Link href="/export">{data ? `${data.payroll.approved} / ${data.payroll.total}` : "—"} ›</Link></div>
          <div><span>{t("homeDashboard.offlineKiosks")}</span><Link href="/kiosks">{data?.health.kiosksOffline ?? "—"} ›</Link></div>
        </div>
      </section>
    </div>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><h2>{t("home.wasteByBranch")}</h2><Link href="/waste-branches">{t("homeDashboard.details")} ›</Link></div>{waste && waste.length > 0 ? <RankBars data={waste} tone="blue" unit="€" /> : <p className="dashboard-muted">{t("homeDashboard.noWasteTrend")}</p>}</section>
  </div>;
}

// ─────────── SHARED ───────────
function Shortcut({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link href={href} className="feature-card">
      <div className="feature-icon" style={{ background: "var(--accent-soft)" }}><Icon e={icon} size={20} color="var(--gold-ink)" /></div>
      <div className="u-flex1">
        <div className="feature-title">{title}</div>
        <div className="feature-sub">{sub}</div>
      </div>
      <span className="feature-chev">›</span>
    </Link>
  );
}
