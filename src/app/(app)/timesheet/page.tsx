"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getMyTimesheet } from "@/lib/queries/timepay";

export default function TimesheetPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  async function load(m?: string) {
    setLoading(true);
    const res = await getMyTimesheet(m);
    if (res.ok) { setRows(res.rows); setMonth(res.month ?? ""); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    load(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = month ? new Date(month + "-01").toLocaleDateString([], { month: "long", year: "numeric" }) : "";
  const fmtT = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtD = (d: string) => new Date(d).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
  const fmtDur = (m: number | null) => m == null ? "—" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  const totalMins = rows.reduce((s, r) => s + (r.duration_mins || 0), 0);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📋 My Timesheet</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Every shift, in detail.</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => shiftMonth(-1)} style={navBtn}>‹ Prev</button>
        <span style={{ fontSize: 14, color: "#d4a847", fontWeight: 600 }}>{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} style={navBtn}>Next ›</button>
      </div>

      {loading ? <CardSkeleton rows={3} />
      : rows.length === 0 ? <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No shifts this month.</div>
      : (
        <>
          <div style={{ ...card, marginBottom: 10, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#9a8f8f" }}>Month total</span>
            <span style={{ color: "#d4a847", fontWeight: 700 }}>{fmtDur(totalMins)}</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtD(r.work_date)}</div>
                  <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>
                    {fmtT(r.clock_in)} → {fmtT(r.clock_out)}
                    {r.status !== "complete" && <span style={{ color: "#e8a35a" }}> · {r.status}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#d4a847" }}>{r.status === "complete" ? fmtDur(r.duration_mins) : "—"}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const navBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };