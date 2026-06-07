import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/queries/admin";
import { getMyHours } from "@/lib/queries/timepay";
import { getMyStatus } from "@/lib/queries/attendance";
import Link from "next/link";

// Role-based home DASHBOARD (replaces the old card-wall). Each role gets a
// focused, glanceable screen — live stats up top, then a short set of primary
// shortcuts. Everything else now lives in the hub nav (My Day / Schedule /
// Attendance) so the home stays clean.
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

  // Fetch only the data each role needs
  let staffHours: { totalHours: number; shifts: number; targetHours: number | null } | null = null;
  let staffClockedIn = false;
  let staffOnBreak = false;
  let mgrStats: { clockedIn: number; staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null = null;

  if (isManager) {
    const d = await getDashboardStats();
    if (d.ok) mgrStats = d.stats;
  } else {
    const h = await getMyHours();
    if (h.ok) staffHours = { totalHours: h.totalHours || 0, shifts: h.shifts || 0, targetHours: h.targetHours ?? null };
    const st = await getMyStatus();
    if (st.ok) { staffClockedIn = st.clockedIn || false; staffOnBreak = st.onBreak || false; }
  }

  return (
    <div className="fade-up">
      {/* Greeting profile pill */}
      <div className="profile-pill">
        <div className={`avatar${isManager ? " mgr" : ""}`}>
          {(profile?.full_name || "?")[0].toUpperCase()}
        </div>
        <div>
          <div className="profile-name">
            {greeting}, {firstName}
            <span className="mgr-badge">{roleLabel[role]}</span>
          </div>
          <div className="profile-sub">{profile?.team || roleLabel[role]} · Schnitzery Stuttgart</div>
        </div>
      </div>

      {isOwner ? (
        <OwnerDash stats={mgrStats} />
      ) : isManager ? (
        <ManagerDash stats={mgrStats} />
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
      {/* Clock status hero */}
      <Link href="/attendance" className="feature-card" style={{ background: clockedIn ? "linear-gradient(135deg,rgba(39,174,96,0.18),rgba(20,20,20,0.4))" : "linear-gradient(145deg,var(--dark2),var(--dark))" }}>
        <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}>🕐</div>
        <div style={{ flex: 1 }}>
          <div className="feature-title">{clockTitle}</div>
          <div className="feature-sub">{clockSub}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* This month stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "4px 0 14px" }}>
        <Stat value={`${hours?.totalHours ?? 0}h`} label="This Month" color="var(--gold-light)" />
        <Stat value={hours?.shifts ?? 0} label="Shifts" />
        <Stat value={target != null ? `${pct}%` : "—"} label="Of Target" color={pct >= 80 ? "#58d68d" : "var(--white)"} />
      </div>

      <div className="section-label">Quick Actions</div>
      <Shortcut href="/schedule" icon="📅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="My Shifts" sub="Your weekly schedule & swaps" />
      <Shortcut href="/my-day" icon="🗓" grad="linear-gradient(135deg,#8b6914,#d4a847)" title="My Day" sub="Availability · time off · hours" />

      <div className="section-label">Workplace</div>
      <Shortcut href="/checklist" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Daily Checklist" sub="Opening & closing tasks" />
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Announcements" sub="Team news & updates" />
      <Shortcut href="/directory" icon="📇" grad="linear-gradient(135deg,#2c3e50,#34495e)" title="Team Directory" sub="Find & contact colleagues" />
      <Shortcut href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Report Incident" sub="Accidents, hazards & issues" />
    </>
  );
}

// ─────────── MANAGER DASHBOARD ───────────
function ManagerDash({ stats }: { stats: { clockedIn: number; staffCount: number; pendingApprovals: number; openIncidents: number; lowStock: number; checklistDone: number; checklistTotal: number } | null }) {
  const s = stats || { clockedIn: 0, staffCount: 0, pendingApprovals: 0, openIncidents: 0, lowStock: 0, checklistDone: 0, checklistTotal: 0 };
  const attention = s.pendingApprovals + s.openIncidents + s.lowStock;

  return (
    <>
      {attention > 0 && (
        <div className="card" style={{ background: "linear-gradient(135deg,rgba(230,126,34,0.12),rgba(20,20,20,0.3))", borderColor: "rgba(230,126,34,0.3)" }}>
          <div style={{ fontSize: 13, color: "var(--white)", fontWeight: 600 }}>
            🔔 {attention} thing{attention === 1 ? "" : "s"} need your attention
          </div>
          <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 4 }}>
            {s.pendingApprovals > 0 && `${s.pendingApprovals} approval${s.pendingApprovals === 1 ? "" : "s"} · `}
            {s.openIncidents > 0 && `${s.openIncidents} open incident${s.openIncidents === 1 ? "" : "s"} · `}
            {s.lowStock > 0 && `${s.lowStock} low-stock item${s.lowStock === 1 ? "" : "s"}`}
          </div>
        </div>
      )}

      <div className="section-label">Today at a Glance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Stat value={s.clockedIn} label="Working Now" color="#58d68d" />
        <Stat value={s.staffCount} label="Team Size" />
        <Stat value={s.pendingApprovals} label="Approvals" color={s.pendingApprovals > 0 ? "#e8a35a" : "var(--white)"} />
        <Stat value={s.openIncidents} label="Incidents" color={s.openIncidents > 0 ? "#ec7063" : "var(--white)"} />
        <Stat value={s.lowStock} label="Low Stock" color={s.lowStock > 0 ? "#e8a35a" : "var(--white)"} />
        <Stat value={`${s.checklistDone}/${s.checklistTotal}`} label="Checklist" color={s.checklistTotal > 0 && s.checklistDone === s.checklistTotal ? "#58d68d" : "var(--white)"} />
      </div>

      <div className="section-label">Manage</div>
      <Shortcut href="/dashboard" icon="🔴" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Live Attendance" sub="Who's working, on break, completed" />
      <Shortcut href="/roster" icon="📋" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Weekly Roster" sub="Build & publish the schedule" />
      <Shortcut href="/approvals" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Approvals" sub="Leave & swap requests" />
      <Shortcut href="/people-hub" icon="👥" grad="linear-gradient(135deg,#6b2fa0,#9b59b6)" title="People & Team" sub="Staff, directory & notes" />
      <Shortcut href="/announcements" icon="📣" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Post Announcement" sub="Send news to all staff" />
      <Shortcut href="/settings-hub" icon="⚙️" grad="linear-gradient(135deg,#555,#777)" title="Settings" sub="Config, reports & tools" />
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

// ─────────── SHARED BITS ───────────
function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
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