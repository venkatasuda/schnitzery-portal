"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getAuditLog } from "@/lib/queries/admin";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getAuditLog();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
      setLogs(res.logs);
      setLoading(false);
    })();
  }, []);

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>🔒 Audit Log</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Recent activity on your branch.</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : logs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No activity logged yet.</div>
      ) : (
        logs.map((l) => (
          <div key={l.id} style={{ ...card, marginBottom: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{(l.action || "").replace(/_/g, " ")}</div>
              {l.details && <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>{l.details}</div>}
              <div style={{ fontSize: 11, color: "#6f6565", marginTop: 2 }}>by {l.actor || "—"}</div>
            </div>
            <div style={{ fontSize: 11, color: "#6f6565", whiteSpace: "nowrap" }}>{fmt(l.created_at)}</div>
          </div>
        ))
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };