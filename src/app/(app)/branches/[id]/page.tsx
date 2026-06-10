"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
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

  if (loading) return <CardSkeleton rows={3} />;
  if (error) return (
    <div>
      <Link href="/branches" style={{ color: "***REMOVED***d4a847", fontSize: 13, textDecoration: "none" }}>‹ Back to branches</Link>
      <div className="card" style={{ textAlign: "center", color: "***REMOVED***ec7063", marginTop: 16 }}>{error}</div>
    </div>
  );

  const { branch, stats, staffList } = data;
  const TEAM_COLORS: Record<string, string> = { Manager: "***REMOVED***3498db", Preparation: "***REMOVED***d4a847", Kitchen: "***REMOVED***27ae60", Cashier: "***REMOVED***9b59b6" };

  return (
    <div>
      <Link href="/branches" style={{ color: "***REMOVED***d4a847", fontSize: 13, textDecoration: "none" }}>‹ Back to all branches</Link>
      <h1 className="page-title" style={{ marginTop: 10 }}>{branch.name}</h1>
      <p className="page-sub">{branch.address || "—"}{branch.franchise ? ` · ${branch.franchise}` : ""}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Stat label="Staff" value={stats.staff} color="***REMOVED***3498db" />
        <Stat label="Working now" value={stats.workingNow} color="***REMOVED***58d68d" />
        <Stat label="Pending leave" value={stats.pendingLeave} color={stats.pendingLeave ? "***REMOVED***d4a847" : "***REMOVED***58d68d"} />
        <Stat label="Open incidents" value={stats.openIncidents} color={stats.openIncidents ? "***REMOVED***ec7063" : "***REMOVED***58d68d"} />
        <Stat label="Low stock" value={stats.lowStock} color={stats.lowStock ? "***REMOVED***e8a35a" : "***REMOVED***58d68d"} />
      </div>

      <div className="section-label">Team ({staffList.length})</div>
      {staffList.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "***REMOVED***9a8f8f", padding: 30 }}>No staff assigned to this branch yet.</div>
      ) : (
        staffList.map((s: any) => (
          <div key={s.id} className="card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: TEAM_COLORS[s.team] || "***REMOVED***666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "***REMOVED***fff", flexShrink: 0 }}>
              {(s.full_name || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.full_name}</div>
              <div style={{ fontSize: 12, color: "***REMOVED***9a8f8f" }}>{s.team || "No team"} · {s.role}</div>
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
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "***REMOVED***fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "***REMOVED***9a8f8f", marginTop: 2 }}>{label}</div>
    </div>
  );
}