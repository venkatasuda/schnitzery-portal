import { createClient } from "@/lib/supabase/server";
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
import { ProgressRing, DonutStat, MiniBars, RankBars, Legend } from "@/components/dash/Charts";
import { getWasteTrends, getWasteByBranch } from "@/lib/queries/waste";

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
  let ownerStats: { clockedIn: number; staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;
  let mOps: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;
  let mLive: { workingNow: number; completed: number; late: number; totalMins: number } | null = null;
  let mOt: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null = null;
  let mSched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null = null;
  let mCost: { laborPct: number | null; foodCostPct: number | null } | null = null;
  let mWaste: { label: string; value: number }[] = [];
  let hqWaste: { label: string; value: number }[] = [];

  // kick off the document check now so it runs in parallel with the role queries
  const docsP = listMyDocuments();

  if (isHQ) {
    const [d, cRes, wRes] = await Promise.all([getDashboardStats(), getLaborSummary(), getWasteByBranch(30).catch(() => ({ ok: false }))]);
    if (d.ok) ownerStats = d.stats ?? null;
    if ((cRes as any).ok) mCost = cRes as any;
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
      <div className="profile-pill">
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

      {myExpiring.length > 0 && (
        <div className="card" style={{ borderColor: "rgba(231,76,60,0.4)", background: "rgba(231,76,60,0.08)", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "#ec7063", fontSize: 14, marginBottom: 4 }}>
            <Icon e="⚠" size={15} color="#ec7063" /> {t("home.docsNeedAttention")}
          </div>
          {myExpiring.slice(0, 3).map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--white)", marginTop: 2 }}>
              {e.days < 0 ? t("home.docExpired", { doc: e.label, days: Math.abs(e.days) }) : e.days === 0 ? t("home.docToday", { doc: e.label }) : t("home.docSoon", { doc: e.label, days: e.days })}
            </div>
          ))}
          <Link href="/profile" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none", display: "inline-block", marginTop: 8 }}>{t("home.updateInProfile")} ›</Link>
        </div>
      )}

      {isManager && <StatusStrip />}

      {isHQ ? (
        <OwnerDash t={t} waste={hqWaste} />
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
      <Link href="/attendance" className="feature-card" style={{ background: clockedIn ? "linear-gradient(135deg,rgba(39,174,96,0.18),rgba(20,20,20,0.4))" : "linear-gradient(145deg,var(--dark2),var(--dark))" }}>
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}><Icon e="🕐" size={22} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{clockTitle}</div>
          <div className="feature-sub">{clockSub}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, margin: "4px 0 14px", padding: 16 }}>
        {target != null && <ProgressRing pct={pct} label={t("home.ofTarget")} tone={pct >= 80 ? "green" : "gold"} size={108} />}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat value={`${hours?.totalHours ?? 0}h`} label={t("home.thisMonthStat")} color="var(--gold-light)" />
          <Stat value={hours?.shifts ?? 0} label={t("nav.shifts")} />
          {target == null && <Stat value="—" label={t("home.ofTarget")} />}
        </div>
      </div>

      <div className="section-label">{t("home.workplace")}</div>
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title={t("home.announcements")} sub={t("home.announcementsSub")} />
      <Shortcut href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title={t("home.reportIncident")} sub={t("home.reportIncidentSub")} />
      <Shortcut href="/temp" icon="🌡️" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title={t("home.tempLog")} sub={t("home.tempLogSub")} />
      <Shortcut href="/waste" icon="🗑️" grad="linear-gradient(135deg,#7b241c,#e74c3c)" title={t("home.wasteLog")} sub={t("home.wasteLogSub")} />
      <Shortcut href="/expiry" icon="📅" grad="linear-gradient(135deg,#6c3483,#a569bd)" title={t("home.expiry")} sub={t("home.expirySub")} />
    </>
  );
}

// ─────────── MANAGER DASHBOARD ───────────
function ManagerDash({ ops, live, ot, sched, clockedIn, onBreak, owner = false, cost, waste, t }: {
  ops: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null;
  live: { workingNow: number; completed: number; late: number; totalMins: number } | null;
  ot: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null;
  sched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null;
  clockedIn: boolean; onBreak: boolean; owner?: boolean; cost?: { laborPct: number | null; foodCostPct: number | null } | null; waste?: { label: string; value: number }[]; t: Tf;
}) {
  const clockTitle = onBreak ? t("home.clockOnBreak") : clockedIn ? t("home.clockWorking") : t("home.clockInOut");
  const clockSub = onBreak ? t("home.clockSubBreak") : clockedIn ? t("home.clockSubWorking") : t("home.clockSubIdle");
  const o = ops || { staffCount: 0, pendingApprovals: 0, openIncidents: 0, lowStock: 0, checklistDone: 0, checklistTotal: 0 };
  const lv = live || { workingNow: 0, completed: 0, late: 0, totalMins: 0 };
  const otd = ot || { totalWorkedMins: 0, totalOvertimeMins: 0, peopleOver: 0 };
  const sc = sched || { submissionCount: 0, staffCount: 0, rosterExists: false };

  const missing = Math.max(0, sc.staffCount - sc.submissionCount);
  const alerts: { icon: string; href: string; text: string; color: string }[] = [];
  if (o.pendingApprovals > 0) alerts.push({ icon: "✅", href: "/approvals", text: t("home.approvalsWaiting", { n: o.pendingApprovals }), color: "#e8a35a" });
  if (o.openIncidents > 0) alerts.push({ icon: "🚨", href: "/incidents", text: t("home.openIncidents", { n: o.openIncidents }), color: "#ec7063" });
  if (o.lowStock > 0) alerts.push({ icon: "📦", href: "/inventory", text: t("home.lowStock", { n: o.lowStock }), color: "#e8a35a" });
  if (missing > 0) alerts.push({ icon: "📋", href: "/noshow", text: t("home.notSubmitted", { n: missing }), color: "#e8a35a" });

  const checklistPct = o.checklistTotal > 0 ? Math.round((o.checklistDone / o.checklistTotal) * 100) : 0;
  const checklistDone = o.checklistTotal > 0 && o.checklistDone === o.checklistTotal;

  return (
    <>
      {/* MY CLOCK — managers are employees too; branch owners are not, so no clock-in for them */}
      {!owner && (
        <Link href="/attendance" className="feature-card" style={{ background: clockedIn ? "linear-gradient(135deg,rgba(39,174,96,0.18),rgba(20,20,20,0.4))" : "linear-gradient(145deg,var(--dark2),var(--dark))", marginBottom: 14 }}>
          <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}><Icon e="🕐" size={22} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div className="feature-title">{clockTitle}</div>
            <div className="feature-sub">{clockSub}</div>
          </div>
          <span className="feature-chev">›</span>
        </Link>
      )}

      {/* NEEDS ATTENTION */}
      <div className="section-label">{t("home.needsAttention")}</div>
      {alerts.length === 0 ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "rgba(39,174,96,0.25)" }}>
          <Icon e="✅" size={20} color="#58d68d" />
          <div><div style={{ fontSize: 14, fontWeight: 600, color: "#58d68d" }}>{t("home.allClear")}</div><div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.allClearSub")}</div></div>
        </div>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderBottom: i < alerts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none", textDecoration: "none" }}>
              <Icon e={a.icon} size={18} color={a.color} />
              <span style={{ flex: 1, fontSize: 14, color: "var(--white)" }}>{a.text}</span>
              <span style={{ color: a.color, fontSize: 18 }}>›</span>
            </Link>
          ))}
        </div>
      )}

      <Link href="/action" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", margin: "10px 0 4px", color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>
        <Icon e="🎯" size={15} color="var(--gold)" /> {t("act.open")} ›
      </Link>

      {/* TODAY */}
      <div className="section-label">{t("home.today")}</div>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, padding: 16 }}>
        <DonutStat
          size={128}
          centerValue={lv.workingNow + lv.completed}
          centerLabel={t("home.today")}
          segments={[
            { name: t("home.statWorking"), value: lv.workingNow, tone: "green" },
            { name: t("home.statDone"), value: lv.completed, tone: "gold" },
            { name: t("home.statLate"), value: lv.late, tone: "red" },
          ]}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Legend items={[
            { name: t("home.statWorking"), tone: "green", value: lv.workingNow },
            { name: t("home.statDone"), tone: "gold", value: lv.completed },
            { name: t("home.statLate"), tone: "red", value: lv.late },
          ]} />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(128,128,128,0.15)", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--font-display)" }}>{fmtH(lv.totalMins)}</span>
            <span style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.hours")}</span>
          </div>
        </div>
      </div>
      <Link href={owner ? "/checklist-status" : "/checklist"} className="feature-card">
        <div className="feature-icon" style={{ background: checklistDone ? "linear-gradient(135deg,#1e8449,#27ae60)" : "linear-gradient(135deg,#b9770e,#e67e22)" }}><Icon e={checklistDone ? "✅" : "📋"} size={22} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{t("home.dailyChecklist")} {o.checklistTotal > 0 && <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400 }}>· {o.checklistDone}/{o.checklistTotal}</span>}</div>
          <div className="feature-sub">{checklistDone ? t("home.allTasksDone") : t("home.openingClosing")}</div>
          {o.checklistTotal > 0 && (
            <div style={{ height: 5, background: "rgba(128,128,128,0.15)", borderRadius: 4, marginTop: 7, overflow: "hidden" }}>
              <div style={{ width: `${checklistPct}%`, height: "100%", background: checklistDone ? "#58d68d" : "var(--gold)" }} />
            </div>
          )}
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* THIS MONTH (analytics) */}
      <div className="section-label">{t("home.thisMonth")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Stat value={fmtH(otd.totalWorkedMins)} label={t("home.hoursWorked")} color="var(--gold-light)" />
        <Stat value={fmtH(otd.totalOvertimeMins)} label={t("home.overtime")} color={otd.totalOvertimeMins > 0 ? "#e8a35a" : "var(--white)"} />
        <Stat value={otd.peopleOver} label={t("home.overContract")} color={otd.peopleOver > 0 ? "#e8a35a" : "#58d68d"} />
      </div>
      <Link href="/schedule-hub" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
        <Icon e="📅" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{sc.rosterExists ? t("home.rosterBuilt") : t("home.rosterOpen")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.availSubmitted", { a: sc.submissionCount, b: sc.staffCount })}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/analytics" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <Icon e="📈" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t("home.analytics")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.analyticsSub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {(cost?.laborPct != null || cost?.foodCostPct != null) ? (
        <Link href="/labor" className="card" style={{ display: "block", textDecoration: "none", marginTop: 8, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)", display: "flex", alignItems: "center", gap: 8 }}><Icon e="💶" size={16} color="var(--gold)" /> {t("home.costThisMonth")}</div>
            <span className="feature-chev">›</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", gap: 12 }}>
            {cost?.laborPct != null && <ProgressRing pct={cost.laborPct} label={t("home.laborPct")} tone={cost.laborPct <= 30 ? "green" : cost.laborPct <= 35 ? "gold" : "red"} size={102} />}
            {cost?.foodCostPct != null && <ProgressRing pct={cost.foodCostPct} label={t("home.foodCostPct")} tone={cost.foodCostPct <= 30 ? "green" : cost.foodCostPct <= 35 ? "gold" : "red"} size={102} />}
          </div>
        </Link>
      ) : (
        <Link href="/labor" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
          <Icon e="💶" size={18} color="var(--gold)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t("home.costThisMonth")}</div>
            <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.costSub", { l: "—", f: "—" })}</div>
          </div>
          <span className="feature-chev">›</span>
        </Link>
      )}

      {waste && waste.some((w) => w.value > 0) && (
        <Link href="/waste" className="card" style={{ display: "block", textDecoration: "none", marginTop: 8, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)", display: "flex", alignItems: "center", gap: 8 }}><Icon e="🗑️" size={16} color="var(--gold)" /> {t("home.wasteTrend")}</div>
            <span className="feature-chev">›</span>
          </div>
          <MiniBars data={waste} tone="red" unit="€" />
        </Link>
      )}

      <Link href="/summary" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <Icon e="📊" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t("home.monthlySummary")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.monthlySummarySub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/compliance" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <Icon e="⚖" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t("home.compliance")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.complianceSub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/people-hub" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <Icon e="👥" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{t("home.peopleTeam")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("home.peopleTeamSub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* DAILY OPERATIONS */}
      <div className="section-label">{t("home.dailyOps")}</div>
      {/* Inventory groups stock counts, alerts, waste, expiry and transfers on its own page. */}
      <Shortcut href="/inventory" icon="📦" grad="linear-gradient(135deg,#8b6914,#d4a847)" title={t("home.inventory")} sub={t("home.inventoryHubSub")} />
      <Shortcut href="/temp" icon="🌡️" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title={t("home.tempLog")} sub={t("home.tempLogSubMgr")} />
      <Shortcut href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title={t("home.reportIncident")} sub={t("home.reportIncidentSubMgr")} />
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title={t("home.postAnnouncement")} sub={t("home.postAnnouncementSub")} />
    </>
  );
}

// ─────────── OWNER DASHBOARD (HQ oversight only) ───────────
// Cross-branch view for a brand owner. Deliberately contains NO single-branch
// shop-floor tools (roster, temp log, waste log, food expiry, inventory,
// transfers) — those live in the branch view, reachable via the HQ/Branch
// toggle in the header. Keeping this screen to oversight is the whole point of
// the split; see src/lib/viewMode.ts.
function OwnerDash({ t, waste }: { t: Tf; waste?: { label: string; value: number }[] }) {
  return (
    <>
      <Link href="/overview" className="feature-card" style={{ background: "linear-gradient(135deg,rgba(212,168,71,0.14),rgba(20,20,20,0.4))", borderColor: "rgba(212,168,71,0.3)" }}>
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1e6091,#2980b9)" }}><Icon e="🏢" size={22} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{t("org.title")}</div>
          <div className="feature-sub">{t("org.subtitle")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/branches" className="feature-card">
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}><Icon e="🗂" size={22} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{t("home.allBranches")}</div>
          <div className="feature-sub">{t("home.allBranchesSub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <div className="section-label">{t("home.insights")}</div>
      {waste && waste.length > 0 && (
        <Link href="/waste-branches" className="card" style={{ display: "block", textDecoration: "none", marginBottom: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)", display: "flex", alignItems: "center", gap: 8 }}><Icon e="🗑️" size={16} color="var(--gold)" /> {t("home.wasteByBranch")}</div>
            <span className="feature-chev">›</span>
          </div>
          <RankBars data={waste} tone="red" unit="€" />
        </Link>
      )}
      <Shortcut href="/analytics" icon="📊" grad="linear-gradient(135deg,#1e6091,#2980b9)" title={t("home.analytics")} sub={t("home.analyticsSub")} />
      <Shortcut href="/waste-branches" icon="🗑️" grad="linear-gradient(135deg,#7b241c,#e74c3c)" title={t("home.wasteByBranch")} sub={t("home.wasteByBranchSub")} />
      <Shortcut href="/labor" icon="💶" grad="linear-gradient(135deg,#8b6914,#d4a847)" title={t("home.costAnalytics")} sub={t("home.costAnalyticsSub")} />
      <Shortcut href="/expiring-docs" icon="📑" grad="linear-gradient(135deg,#6c3483,#a569bd)" title={t("home.docsCompliance")} sub={t("home.docsComplianceSub")} />

      <div className="section-label">{t("home.manage")}</div>
      <Shortcut href="/people-hub" icon="👥" grad="linear-gradient(135deg,#922b21,#c0392b)" title={t("home.peopleTeam")} sub={t("home.peopleTeamSub")} />
      <Shortcut href="/profile" icon="⚙" grad="linear-gradient(135deg,#555,#777)" title={t("home.settings")} sub={t("home.settingsSub")} />
    </>
  );
}

// ─────────── SHARED ───────────
function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function Shortcut({ href, icon, grad, title, sub }: { href: string; icon: string; grad: string; title: string; sub: string }) {
  return (
    <Link href={href} className="feature-card">
      <div className="feature-icon" style={{ background: grad }}><Icon e={icon} size={22} color="#fff" /></div>
      <div style={{ flex: 1 }}>
        <div className="feature-title">{title}</div>
        <div className="feature-sub">{sub}</div>
      </div>
      <span className="feature-chev">›</span>
    </Link>
  );
}