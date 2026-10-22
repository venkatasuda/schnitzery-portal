"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getMyHours } from "@/lib/queries/timepay";
import { Stat } from "@/components/ui";

export default function HoursPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  async function load(m?: string) {
    setLoading(true);
    const res = await getMyHours(m);
    if (res.ok) { setData(res); setMonth(res.month ?? ""); }
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
      <h1 className="page-title u-row"><Icon e="⏱" size={22} /> My Hours</h1>
      <p className="ui-lede">Your worked hours this month.</p>

      <div className="d-flex jc-sb ai-c mb-4">
        <button className="btn-secondary ui-btn-sm" onClick={() => shiftMonth(-1)}>‹ Prev</button>
        <span className="t-md tone-action fw-6">{monthLabel}</span>
        <button className="btn-secondary ui-btn-sm" onClick={() => shiftMonth(1)}>Next ›</button>
      </div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : !data ? (
        <div style={{ ...card, textAlign: "center", color: "var(--gray)" }}>No data.</div>
      ) : (
        <>
          <div style={{ ...card, textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: "var(--gold-ink)", fontFamily: "var(--font-body)" }}>{data.totalHours}h</div>
            <div style={{ fontSize: 12, color: "var(--gray)", letterSpacing: 1, marginTop: 4 }}>WORKED THIS MONTH</div>
          </div>

          <div className="d-flex gap-3 mb-3">
            <Stat label="Shifts" value={String(data.shifts)} />
            <Stat label="Target" value={data.targetHours != null ? `${data.targetHours}h` : "—"} />
            <Stat label={data.debt != null && data.debt > 0 ? "Remaining" : "Over"} value={data.debt != null ? `${Math.abs(data.debt)}h` : "—"} color={data.debt != null && data.debt > 0 ? "var(--warn)" : "var(--success)"} />
          </div>

          {data.targetHours != null && (
            <div className="card">
              <div className="t-xs u-muted mb-2">Progress to {data.targetHours}h target</div>
              <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#27ae60" : "#d4a847", transition: "width 0.4s" }} />
              </div>
              <div className="t-xs tone-action u-center mt-2">{pct}%</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };