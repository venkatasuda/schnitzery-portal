import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Role-routed home. Each role sees ONLY their portal's features.
//  - staff            → Employee portal
//  - manager          → Manager portal (one branch)
//  - franchise_owner  → (Phase B) for now sees Manager portal + a notice
//  - brand_owner      → (Phase B) for now sees Manager portal + a notice
export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users").select("full_name, role, team").eq("id", user.id).single();
    profile = data;
  }
  const role = profile?.role || "staff";
  const isManager = ["manager", "franchise_owner", "brand_owner"].includes(role);
  const isOwner = ["franchise_owner", "brand_owner"].includes(role);

  const roleLabel: Record<string, string> = {
    staff: "Employee", manager: "Manager",
    franchise_owner: "Franchise Owner", brand_owner: "Brand Owner",
  };

  return (
    <div>
      {/* Profile pill */}
      <div className="profile-pill">
        <div className={`avatar${isManager ? " mgr" : ""}`}>
          {(profile?.full_name || "?")[0].toUpperCase()}
        </div>
        <div>
          <div className="profile-name">
            {profile?.full_name || "—"}
            <span className="mgr-badge">{roleLabel[role]}</span>
          </div>
          <div className="profile-sub">{profile?.team || roleLabel[role]} Portal</div>
        </div>
      </div>

      {isOwner ? <OwnerPortal role={role} /> : !isManager ? <EmployeePortal /> : <ManagerPortal />}
    </div>
  );
}

// ─────────── EMPLOYEE PORTAL ───────────
function EmployeePortal() {
  return (
    <>
      <div className="section-label">My Work</div>
      <FeatureCard href="/attendance" icon="🕐" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Clock In / Out" sub="Track today's hours" />
      <FeatureCard href="/schedule" icon="📅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="My Shifts" sub="Your weekly schedule & swaps" />
      <FeatureCard href="/hours" icon="⏱" grad="linear-gradient(135deg,#6b2fa0,#9b59b6)" title="My Hours" sub="Monthly hours & timesheet" />
      <FeatureCard href="/leave" icon="🌴" grad="linear-gradient(135deg,#117a65,#16a085)" title="Time Off" sub="Request leave" />
      <FeatureCard href="/availability" icon="🗓" grad="linear-gradient(135deg,#8b6914,#d4a847)" title="My Availability" sub="Mark shifts you can work" />

      <div className="section-label">Workplace</div>
      <FeatureCard href="/checklist" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Daily Checklist" sub="Opening & closing tasks" />
      <FeatureCard href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Announcements" sub="Team news & updates" />
      <FeatureCard href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Report Incident" sub="Accidents, hazards & issues" />
      <FeatureCard href="/directory" icon="📇" grad="linear-gradient(135deg,#2c3e50,#34495e)" title="Team Directory" sub="Find & contact colleagues" />
      <FeatureCard href="/leave-calendar" icon="📆" grad="linear-gradient(135deg,#117a65,#16a085)" title="Team Leave Calendar" sub="See who's off" />
    </>
  );
}

// ─────────── MANAGER PORTAL ───────────
function ManagerPortal() {
  return (
    <>
      <div className="section-label">Overview</div>
      <FeatureCard href="/dashboard" icon="📊" grad="linear-gradient(135deg,#6b2fa0,#9b59b6)" title="Dashboard" sub="Live branch overview" />
      <FeatureCard href="/approvals" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Approvals" sub="Leave & swap requests" />
      <FeatureCard href="/noshow" icon="⚠️" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Attendance Checks" sub="No-shows & missing availability" />

      <div className="section-label">Scheduling & Team</div>
      <FeatureCard href="/roster" icon="📋" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Weekly Roster" sub="Build the schedule" />
      <FeatureCard href="/staff" icon="👥" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Staff Management" sub="Manage your team" />
      <FeatureCard href="/notes" icon="📝" grad="linear-gradient(135deg,#2c3e50,#34495e)" title="Notes & Recognition" sub="Performance notes" />
      <FeatureCard href="/clock-display" icon="📲" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Clock-In Display" sub="QR + code screen for staff" />

      <div className="section-label">Operations</div>
      <FeatureCard href="/inventory" icon="📦" grad="linear-gradient(135deg,#8b6914,#d4a847)" title="Inventory" sub="Stock counts & alerts" />
      <FeatureCard href="/checklist" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Daily Checklist" sub="Opening & closing tasks" />
      <FeatureCard href="/incidents" icon="🚨" grad="linear-gradient(135deg,#b9770e,#e67e22)" title="Incidents" sub="Review reported issues" />
      <FeatureCard href="/announcements" icon="📣" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Announcements" sub="Post team news" />

      <div className="section-label">Time & Admin</div>
      <FeatureCard href="/export" icon="📤" grad="linear-gradient(135deg,#117a65,#16a085)" title="Payroll Export" sub="Hours per staff + CSV" />
      <FeatureCard href="/settings" icon="⚙️" grad="linear-gradient(135deg,#555,#777)" title="Settings" sub="Branch configuration" />
      <FeatureCard href="/audit" icon="🔒" grad="linear-gradient(135deg,#444,#666)" title="Audit Log" sub="Activity history" />

      <div className="section-label">My Own</div>
      <FeatureCard href="/attendance" icon="🕐" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Clock In / Out" sub="Your own attendance" />
      <FeatureCard href="/hours" icon="⏱" grad="linear-gradient(135deg,#6b2fa0,#9b59b6)" title="My Hours" sub="Your timesheet" />
    </>
  );
}

// ─────────── OWNER PORTAL (franchise_owner + brand_owner) ───────────
function OwnerPortal({ role }: { role: string }) {
  const isBrand = role === "brand_owner";
  return (
    <>
      <div className="section-label">{isBrand ? "Brand Overview" : "Franchise Overview"}</div>
      <FeatureCard href="/branches" icon="🏢" grad="linear-gradient(135deg,#6b2fa0,#9b59b6)" title={isBrand ? "All Branches" : "My Branches"} sub="Live stats across every location" />

      <div className="section-label">Manage a Branch</div>
      <FeatureCard href="/dashboard" icon="📊" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Branch Dashboard" sub="Operations for your home branch" />
      <FeatureCard href="/approvals" icon="✅" grad="linear-gradient(135deg,#1e8449,#27ae60)" title="Approvals" sub="Leave & swap requests" />
      <FeatureCard href="/staff" icon="👥" grad="linear-gradient(135deg,#922b21,#c0392b)" title="Staff Management" sub="Manage team & create accounts" />
      <FeatureCard href="/roster" icon="📋" grad="linear-gradient(135deg,#1a6b8a,#3498db)" title="Weekly Roster" sub="Build the schedule" />
      <FeatureCard href="/inventory" icon="📦" grad="linear-gradient(135deg,#8b6914,#d4a847)" title="Inventory" sub="Stock counts & alerts" />

      <div className="section-label">Admin</div>
      <FeatureCard href="/export" icon="📤" grad="linear-gradient(135deg,#117a65,#16a085)" title="Payroll Export" sub="Hours per staff + CSV" />
      <FeatureCard href="/settings" icon="⚙️" grad="linear-gradient(135deg,#555,#777)" title="Settings" sub="Branch configuration" />
      <FeatureCard href="/audit" icon="🔒" grad="linear-gradient(135deg,#444,#666)" title="Audit Log" sub="Activity history" />
    </>
  );
}

function FeatureCard({ href, icon, grad, title, sub }: { href: string; icon: string; grad: string; title: string; sub: string }) {
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