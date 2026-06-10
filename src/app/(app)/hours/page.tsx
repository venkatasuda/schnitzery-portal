"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getMyHours } from "@/lib/queries/timepay";

export default function HoursPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  async function load(m?: string) {
    setLoading(true);
    const res = await getMyHours(m);
    if (res.ok) { setData(res); setMonth(res.month); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    load(next);
  }

  const monthLabel = month ? new Date(month + "-01").toLocaleDateString([], { month: "long", year: "numeric" }) : "";
  const pct = data?.targetHours ? Math.min(100, Math.round((data.totalHours / data.targetHours) * 100)) : 0;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>⏱ My Hours</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Your worked hours this month.</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => shiftMonth(-1)} style={navBtn}>‹ Prev</button>
        <span style={{ fontSize: 14, color: "#d4a847", fontWeight: 600 }}>{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} style={navBtn}>Next ›</button>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : !data ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f" }}>No data.</div>
      ) : (
        <>
          <div style={{ ...card, textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: "#d4a847", fontFamily: "Georgia, serif" }}>{data.totalHours}h</div>
            <div style={{ fontSize: 12, color: "#9a8f8f", letterSpacing: 1, marginTop: 4 }}>WORKED THIS MONTH</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <Stat label="Shifts" value={String(data.shifts)} />
            <Stat label="Target" value={data.targetHours != null ? `${data.targetHours}h` : "—"} />
            <Stat label={data.debt != null && data.debt > 0 ? "Remaining" : "Over"} value={data.debt != null ? `${Math.abs(data.debt)}h` : "—"} color={data.debt != null && data.debt > 0 ? "#e8a35a" : "#58d68d"} />
          </div>

          {data.targetHours != null && (
            <div style={card}>
              <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 8 }}>Progress to {data.targetHours}h target</div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#27ae60" : "#d4a847", transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 12, color: "#d4a847", textAlign: "center", marginTop: 6 }}>{pct}%</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, textAlign: "center", padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9a8f8f", marginTop: 2 }}>{label}</div>
    </div>
  );
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 };
const navBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };