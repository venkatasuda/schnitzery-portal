import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/queries/admin";
import { getMyHours } from "@/lib/queries/timepay";
import { getMyStatus } from "@/lib/queries/attendance";
import { getLiveAttendance, getMonthlyOvertime } from "@/lib/queries/live-attendance";
import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import Link from "next/link";

const fmtH = (mins: number) => `${Math.floor((mins || 0) / 60)}h ${String((mins || 0) % 60).padStart(2, "0")}m`;

// Role-based home dashboard. Managers get a full operational dashboard;
// staff and owners keep their focused views.
export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string | null; team: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("users").select("full_name, role, team").eq("id", user.id).single();
    profile = data;
  }
  const role = profile?.role || "staff";
  const isManager = ["manager", "franchise_owner", "brand_owner"].includes(role);
  const isOwner = ["franchise_owner", "brand_owner"].includes(role);
  const firstName = (profile?.full_name || "there").split(" ")[0];

  const roleLabel: Record<string, string> = {
    staff: "Employee", manager: "Manager",
    franchise_owner: "Franchise Owner", brand_owner: "Brand Owner",
  };
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // ── data ──
  let staffHours: { totalHours: number; shifts: number; targetHours: number | null } | null = null;
  let staffClockedIn = false, staffOnBreak = false;
  let ownerStats: { clockedIn: number; staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;
  let mOps: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;
  let mLive: { workingNow: number; completed: number; late: number; totalMins: number } | null = null;
  let mOt: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null = null;
  let mSched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null = null;

  if (isOwner) {
    const d = await getDashboardStats();
    if (d.ok) ownerStats = d.stats ?? null;
  } else if (isManager) {
    const [dRes, liveRes, otRes, schedRes] = await Promise.all([
      getDashboardStats(), getLiveAttendance(), getMonthlyOvertime(), getScheduleOverview(),
    ]);
    if (dRes.ok) mOps = dRes.stats ?? null;
    if (liveRes.ok) mLive = { workingNow: liveRes.workingNow || 0, completed: liveRes.completed || 0, late: liveRes.late || 0, totalMins: liveRes.totalMins || 0 };
    if (otRes.ok) mOt = { totalWorkedMins: otRes.totalWorkedMins || 0, totalOvertimeMins: otRes.totalOvertimeMins || 0, peopleOver: otRes.peopleOver || 0 };
    if (schedRes.ok) mSched = { submissionCount: schedRes.submissionCount || 0, staffCount: schedRes.staffCount || 0, rosterExists: schedRes.rosterExists || false };
  } else {
    const h = await getMyHours();
    if (h.ok) staffHours = { totalHours: h.totalHours || 0, shifts: h.shifts || 0, targetHours: h.targetHours ?? null };
    const st = await getMyStatus();
    if (st.ok) { staffClockedIn = st.clockedIn || false; staffOnBreak = st.onBreak || false; }
  }

  return (
    <div className="fade-up">
      <div className="profile-pill">
        <div className={`avatar${isManager ? " mgr" : ""}`}>{(profile?.full_name || "?")[0].toUpperCase()}</div>
        <div>
          <div className="profile-name">{greeting}, {firstName}<span className="mgr-badge">{roleLabel[role]}</span></div>
          <div className="profile-sub">{profile?.team || roleLabel[role]} · Schnitzery Stuttgart</div>
        </div>
      </div>

      {isOwner ? (
        <OwnerDash stats={ownerStats} />
      ) : isManager ? (
        <ManagerDash ops={mOps} live={mLive} ot={mOt} sched={mSched} />
      ) : (
        <StaffDash hours={staffHours} clockedIn={staffClockedIn} onBreak={staffOnBreak} />
      )}
    </div>
  );
}

// ─────────── STAFF DASHBOARD ───────────
function StaffDash({ hours, clockedIn, onBreak }: {
  hours: { totalHours: number; shifts: number; targetHours: number | null } | null;
  clockedIn: boolean; onBreak: boolean;
}) {
  const clockTitle = onBreak ? "☕ On Break" : clockedIn ? "🟢 Currently Working" : "🕐 Clock In / Out";
  const clockSub = onBreak ? "Tap to end your break" : clockedIn ? "Tap to take a break or clock out" : "Tap to start tracking today's hours";
  const target = hours?.targetHours ?? null;
  const pct = target && target > 0 ? Math.min(100, Math.round(((hours?.totalHours || 0) / target) * 100)) : 0;

  return (
    <>
      <Link href="/attendance" className="feature-card" style={{ background: clockedIn ? "linear-gradient(135deg,rgba(39,174,96,0.18),rgba(20,20,20,0.4))" : "linear-gradient(145deg,var(--dark2),var(--dark))" }}>
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}>🕐</div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{clockTitle}</div>
          <div className="feature-sub">{clockSub}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "4px 0 14px" }}>
        <Stat value={`${hours?.totalHours ?? 0}h`} label="This Month" color="var(--gold-light)" />
        <Stat value={hours?.shifts ?? 0} label="Shifts" />
        <Stat value={target != null ? `${pct}%` : "—"} label="Of Target" color={pct >= 80 ? "#58d68d" : "var(--white)"} />
      </div>

      <div className="section-label">Workplace</div>
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Announcements" sub="Team news & updates" />
      <Shortcut href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Report Incident" sub="Accidents, hazards & issues" />
    </>
  );
}

// ─────────── MANAGER DASHBOARD ───────────
function ManagerDash({ ops, live, ot, sched }: {
  ops: { staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null;
  live: { workingNow: number; completed: number; late: number; totalMins: number } | null;
  ot: { totalWorkedMins: number; totalOvertimeMins: number; peopleOver: number } | null;
  sched: { submissionCount: number; staffCount: number; rosterExists: boolean } | null;
}) {
  const o = ops || { staffCount: 0, pendingApprovals: 0, openIncidents: 0, lowStock: 0, checklistDone: 0, checklistTotal: 0 };
  const lv = live || { workingNow: 0, completed: 0, late: 0, totalMins: 0 };
  const otd = ot || { totalWorkedMins: 0, totalOvertimeMins: 0, peopleOver: 0 };
  const sc = sched || { submissionCount: 0, staffCount: 0, rosterExists: false };

  const missing = Math.max(0, sc.staffCount - sc.submissionCount);
  const alerts: { icon: string; href: string; text: string; color: string }[] = [];
  if (o.pendingApprovals > 0) alerts.push({ icon: "✅", href: "/approvals", text: `${o.pendingApprovals} approval${o.pendingApprovals === 1 ? "" : "s"} waiting`, color: "#e8a35a" });
  if (o.openIncidents > 0) alerts.push({ icon: "🚨", href: "/incidents", text: `${o.openIncidents} open incident${o.openIncidents === 1 ? "" : "s"}`, color: "#ec7063" });
  if (o.lowStock > 0) alerts.push({ icon: "📦", href: "/inventory", text: `${o.lowStock} low-stock item${o.lowStock === 1 ? "" : "s"}`, color: "#e8a35a" });
  if (missing > 0) alerts.push({ icon: "📋", href: "/noshow", text: `${missing} haven't submitted availability`, color: "#e8a35a" });

  const checklistPct = o.checklistTotal > 0 ? Math.round((o.checklistDone / o.checklistTotal) * 100) : 0;
  const checklistDone = o.checklistTotal > 0 && o.checklistDone === o.checklistTotal;

  return (
    <>
      {/* NEEDS ATTENTION */}
      <div className="section-label">Needs Attention</div>
      {alerts.length === 0 ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "rgba(39,174,96,0.25)" }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div><div style={{ fontSize: 14, fontWeight: 600, color: "#58d68d" }}>All clear</div><div style={{ fontSize: 11, color: "var(--gray)" }}>Nothing needs your attention right now.</div></div>
        </div>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderBottom: i < alerts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none", textDecoration: "none" }}>
              <span style={{ fontSize: 17 }}>{a.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: "var(--white)" }}>{a.text}</span>
              <span style={{ color: a.color, fontSize: 18 }}>›</span>
            </Link>
          ))}
        </div>
      )}

      {/* TODAY */}
      <div className="section-label">Today</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <Stat value={lv.workingNow} label="Working" color="#58d68d" />
        <Stat value={lv.completed} label="Done" />
        <Stat value={lv.late} label="Late" color={lv.late > 0 ? "#ec7063" : "var(--white)"} />
        <Stat value={fmtH(lv.totalMins)} label="Hours" color="var(--gold)" />
      </div>
      <Link href="/checklist" className="feature-card">
        <div className="feature-icon" style={{ background: checklistDone ? "linear-gradient(135deg,#1e8449,#27ae60)" : "linear-gradient(135deg,#b9770e,#e67e22)" }}>{checklistDone ? "✅" : "📋"}</div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">Daily Checklist {o.checklistTotal > 0 && <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400 }}>· {o.checklistDone}/{o.checklistTotal}</span>}</div>
          <div className="feature-sub">{checklistDone ? "All tasks done today 🎉" : "Opening & closing tasks"}</div>
          {o.checklistTotal > 0 && (
            <div style={{ height: 5, background: "rgba(128,128,128,0.15)", borderRadius: 4, marginTop: 7, overflow: "hidden" }}>
              <div style={{ width: `${checklistPct}%`, height: "100%", background: checklistDone ? "#58d68d" : "var(--gold)" }} />
            </div>
          )}
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* THIS MONTH (analytics) */}
      <div className="section-label">This Month</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Stat value={fmtH(otd.totalWorkedMins)} label="Hours Worked" color="var(--gold-light)" />
        <Stat value={fmtH(otd.totalOvertimeMins)} label="Overtime" color={otd.totalOvertimeMins > 0 ? "#e8a35a" : "var(--white)"} />
        <Stat value={otd.peopleOver} label="Over Contract" color={otd.peopleOver > 0 ? "#e8a35a" : "#58d68d"} />
      </div>
      <Link href="/schedule-hub" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>Next week&apos;s roster — {sc.rosterExists ? "Built" : "Open"}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{sc.submissionCount}/{sc.staffCount} availability submitted</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/analytics" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <span style={{ fontSize: 18 }}>📈</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>Detailed Analytics</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>Hours trends, busiest days &amp; punctuality</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/labor" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <span style={{ fontSize: 18 }}>💶</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>Labor Cost</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>Labor vs sales — the key restaurant KPI</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <Link href="/compliance" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 8 }}>
        <span style={{ fontSize: 18 }}>⚖️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>Compliance</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>Break &amp; rest checks (German ArbZG)</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* DAILY OPERATIONS */}
      <div className="section-label">Daily Operations</div>
      <Shortcut href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Report Incident" sub="Log accidents, hazards & issues" />
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Post Announcement" sub="Send news to all staff" />
    </>
  );
}

// ─────────── OWNER DASHBOARD ───────────
function OwnerDash({ stats }: { stats: { clockedIn: number; staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null }) {
  const s = stats || { clockedIn: 0, staffCount: 0, pendingApprovals: 0, openIncidents: 0, lowStock: 0, checklistDone: 0, checklistTotal: 0 };

  return (
    <>
      <Link href="/branches" className="feature-card" style={{ background: "linear-gradient(135deg,rgba(212,168,71,0.14),rgba(20,20,20,0.4))", borderColor: "rgba(212,168,71,0.3)" }}>
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}>🏢</div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">All Branches</div>
          <div className="feature-sub">Live stats across every location</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      <div className="section-label">Home Branch Today</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Stat value={s.clockedIn} label="Working Now" color="#58d68d" />
        <Stat value={s.staffCount} label="Team Size" />
        <Stat value={s.pendingApprovals} label="Approvals" color={s.pendingApprovals > 0 ? "#e8a35a" : "var(--white)"} />
      </div>

      <div className="section-label">Manage</div>
      <Shortcut href="/roster" icon="📋" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Weekly Roster" sub="Build the schedule" />
      <Shortcut href="/people-hub" icon="👥" grad="linear-gradient(135deg,#922b21,#c0392b)" title="People & Team" sub="Staff, directory & notes" />
      <Shortcut href="/inventory" icon="📦" grad="linear-gradient(135deg,#8b6914,#d4a847)" title="Inventory" sub="Stock counts & alerts" />
      <Shortcut href="/settings-hub" icon="⚙️" grad="linear-gradient(135deg,#555,#777)" title="Settings" sub="Config, payroll export & audit" />
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
      <div className="feature-icon" style={{ background: grad }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="feature-title">{title}</div>
        <div className="feature-sub">{sub}</div>
      </div>
      <span className="feature-chev">›</span>
    </Link>
  );
}