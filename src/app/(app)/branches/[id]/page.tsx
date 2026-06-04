"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBranchDetail } from "@/lib/queries/owner";

export default function BranchDetailPage() {
  const params = useParams();
  const branchId = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getBranchDetail(branchId);
      if (!res.ok) { setError(res.error || "Failed."); setLoading(false); return; }
      setData(res);
      setLoading(false);
    })();
  }, [branchId]);

  if (loading) return <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>;
  if (error) return (
    <div>
      <Link href="/branches" style={{ color: "#d4a847", fontSize: 13, textDecoration: "none" }}>‹ Back to branches</Link>
      <div className="card" style={{ textAlign: "center", color: "#ec7063", marginTop: 16 }}>{error}</div>
    </div>
  );

  const { branch, stats, staffList } = data;
  const TEAM_COLORS: Record<string, string> = { Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60", Cashier: "#9b59b6" };

  return (
    <div>
      <Link href="/branches" style={{ color: "#d4a847", fontSize: 13, textDecoration: "none" }}>‹ Back to all branches</Link>
      <h1 className="page-title" style={{ marginTop: 10 }}>{branch.name}</h1>
      <p className="page-sub">{branch.address || "—"}{branch.franchise ? ` · ${branch.franchise}` : ""}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Stat label="Staff" value={stats.staff} color="#3498db" />
        <Stat label="Working now" value={stats.workingNow} color="#58d68d" />
        <Stat label="Pending leave" value={stats.pendingLeave} color={stats.pendingLeave ? "#d4a847" : "#58d68d"} />
        <Stat label="Open incidents" value={stats.openIncidents} color={stats.openIncidents ? "#ec7063" : "#58d68d"} />
        <Stat label="Low stock" value={stats.lowStock} color={stats.lowStock ? "#e8a35a" : "#58d68d"} />
      </div>

      <div className="section-label">Team ({staffList.length})</div>
      {staffList.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "#9a8f8f", padding: 30 }}>No staff assigned to this branch yet.</div>
      ) : (
        staffList.map((s: any) => (
          <div key={s.id} className="card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: TEAM_COLORS[s.team] || "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(s.full_name || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.full_name}</div>
              <div style={{ fontSize: 12, color: "#9a8f8f" }}>{s.team || "No team"} · {s.role}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="card" style={{ textAlign: "center", marginBottom: 0, padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9a8f8f", marginTop: 2 }}>{label}</div>
    </div>
  );
}