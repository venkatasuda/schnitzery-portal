"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardStats } from "@/lib/queries/admin";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getDashboardStats();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
      setStats(res.stats);
      setLoading(false);
    })();
  }, []);

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📊 Dashboard</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 18 }}>Live overview of your branch.</p>

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      ) : !stats ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f" }}>No data.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard icon="🟢" value={stats.clockedIn} label="Working now" color="#58d68d" href="/clock-display" />
            <StatCard icon="👥" value={stats.staffCount} label="Active staff" color="#3498db" href="/staff" />
            <StatCard icon="✅" value={stats.pendingApprovals} label="Pending approvals" color={stats.pendingApprovals ? "#d4a847" : "#58d68d"} href="/approvals" />
            <StatCard icon="🚨" value={stats.openIncidents} label="Open incidents" color={stats.openIncidents ? "#ec7063" : "#58d68d"} href="/incidents" />
            <StatCard icon="📦" value={stats.lowStock} label="Low-stock items" color={stats.lowStock ? "#e8a35a" : "#58d68d"} href="/inventory" />
            <StatCard icon="✔️" value={`${stats.checklistDone}/${stats.checklistTotal}`} label="Checklist today" color="#9b59b6" href="/checklist" />
          </div>

          <div style={{ ...card }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Quick actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <QuickLink href="/roster">📋 Build Roster</QuickLink>
              <QuickLink href="/announcements">📣 Post Announcement</QuickLink>
              <QuickLink href="/export">📤 Payroll Export</QuickLink>
              <QuickLink href="/settings">⚙️ Settings</QuickLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color, href }: any) {
  return (
    <Link href={href} style={{ ...card, textDecoration: "none", display: "block" }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>{label}</div>
    </Link>
  );
}
function QuickLink({ href, children }: any) {
  return <Link href={href} style={{ padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, textDecoration: "none" }}>{children}</Link>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };