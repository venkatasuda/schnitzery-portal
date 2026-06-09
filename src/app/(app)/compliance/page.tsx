"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCompliance } from "@/lib/queries/compliance";
import { Skeleton } from "@/components/Skeleton";

const ICON: Record<string, string> = { Break: "☕", Rest: "🌙", "Long shift": "⏱" };

export default function CompliancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getCompliance().then((r) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  const v = data?.violations || [];

  return (
    <div className="fade-up">
      <div className="page-title">⚖️ Compliance</div>
      <div className="page-sub">German ArbZG · last 14 days · from actual clock-ins</div>

      {loading ? (
        <>
          <Skeleton height={70} radius={12} style={{ marginBottom: 14 }} />
          <Skeleton height={150} radius={12} />
        </>
      ) : (
        <>
          {/* summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Stat value={data.counts.breakCount} label="Break Issues" color={data.counts.breakCount > 0 ? "#ec7063" : "#58d68d"} />
            <Stat value={data.counts.restCount} label="Rest Issues" color={data.counts.restCount > 0 ? "#ec7063" : "#58d68d"} />
            <Stat value={data.counts.longCount} label="Over 10h" color={data.counts.longCount > 0 ? "#e8a35a" : "#58d68d"} />
          </div>

          {v.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
              <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>All compliant</div>
              <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>
                {data.checked} shift{data.checked === 1 ? "" : "s"} checked over the last 14 days — no break, rest, or overtime issues.
              </div>
            </div>
          ) : (
            <>
              <div className="section-label">{v.length} Issue{v.length === 1 ? "" : "s"} ({data.checked} shifts checked)</div>
              <div className="card" style={{ padding: 8 }}>
                {v.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < v.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                    <span style={{ fontSize: 18 }}>{ICON[item.type] || "⚠️"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                        {item.name} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--gray)" }}>· {item.date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: item.severity === "high" ? "#ec7063" : "#e8a35a" }}>{item.type} — {item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* rules reference */}
          <div className="card" style={{ marginTop: 14, fontSize: 12, color: "var(--gray)", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: "var(--white)", marginBottom: 6 }}>The rules being checked (ArbZG)</div>
            ☕ Break: 30 min for shifts over 6h, 45 min over 9h.<br />
            🌙 Rest: at least 11h between the end of one shift and the start of the next.<br />
            ⏱ Daily max: 10h of working time per day.<br />
            <span style={{ fontSize: 11, opacity: 0.8 }}>Restaurants are exempt from Sunday-rest rules (§10), so Sunday work isn&apos;t flagged. This is guidance, not legal advice.</span>
          </div>
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>‹ Back to dashboard</Link>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}