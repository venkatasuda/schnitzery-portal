"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getTeamLeave } from "@/lib/queries/leave";
import { CardSkeleton } from "@/components/Skeleton";

export default function LeaveCalendarPage() {
  const [leave, setLeave] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getTeamLeave();
      if (res.ok) setLeave(res.leave);
      setLoading(false);
    })();
  }, []);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }) : "—";
  const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;

  // group by month for a light calendar feel
  const byMonth: Record<string, any[]> = {};
  for (const l of leave) {
    const m = new Date(l.from_date).toLocaleDateString([], { month: "long", year: "numeric" });
    (byMonth[m] = byMonth[m] || []).push(l);
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="📆" size={22} /> Team Leave Calendar</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Approved upcoming time off across the team.</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : leave.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 40 }}><Icon e="☀️" size={28} color="#9a8f8f" /><br />No upcoming leave booked.</div>
      ) : (
        Object.entries(byMonth).map(([month, items]) => (
          <div key={month} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#9a8f8f", marginBottom: 8 }}>{month.toUpperCase()}</div>
            {items.map((l) => (
              <div key={l.id} style={{ ...card, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{l.users?.full_name || "Staff"}</div>
                  <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 2 }}>
                    {fmtDate(l.from_date)} → {fmtDate(l.to_date)}{l.reason ? ` · ${l.reason}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#d4a847", fontWeight: 600 }}>
                  {daysBetween(l.from_date, l.to_date)}d
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 };