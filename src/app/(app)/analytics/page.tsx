"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { getAnalytics } from "@/lib/queries/analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";

const GOLD = "#d4a847";
const BLUE = "#3498db";
const TEAM_COLORS = ["#c0392b", "#3498db", "#27ae60", "#d4a847", "#9b59b6", "#e67e22"];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getAnalytics().then((r) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  const hasData = data && data.totalShifts > 0;

  return (
    <div className="fade-up">
      <div className="page-title">📈 Analytics</div>
      <div className="page-sub">Last 8 weeks · your branch</div>

      {/* headline stats */}
      {loading ? (
        <div style={{ marginBottom: 14 }}><StatsSkeleton count={3} /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <Stat value={`${data.monthHours}h`} label="Hours / Month" color={GOLD} />
          <Stat value={data.monthShifts} label="Shifts / Month" />
          <Stat value={`${data.lateRate}%`} label="Late Rate" color={data.lateRate > 15 ? "#ec7063" : "#58d68d"} />
        </div>
      )}

      {loading ? (
        <>
          <Skeleton height={14} width="40%" style={{ margin: "18px 0 10px" }} />
          <Skeleton height={210} radius={14} />
          <Skeleton height={14} width="40%" style={{ margin: "22px 0 10px" }} />
          <Skeleton height={210} radius={14} />
        </>
      ) : !hasData ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 36, fontSize: 14, lineHeight: 1.6 }}>
          📊 No attendance data yet.<br />Charts fill in as your team clocks in over the coming weeks.
        </div>
      ) : (
        <>
          <ChartCard title="Hours per Week">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="hours" fill={GOLD} radius={[5, 5, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Hours by Day of Week">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="hours" fill={BLUE} radius={[5, 5, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {data.teams.length > 0 && (
            <ChartCard title="Hours by Team (8 weeks)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.teams} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="team" tick={{ fontSize: 12, fill: "#cfc7c7" }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...tooltip} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
                  <Bar dataKey="hours" radius={[0, 5, 5, 0]} maxBarSize={28}>
                    {data.teams.map((_: any, i: number) => <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>‹ Back to dashboard</Link>
    </div>
  );
}

const tooltip = {
  contentStyle: { background: "#1c1414", border: "1px solid rgba(212,168,71,0.3)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#d4a847" },
  cursor: { fill: "rgba(212,168,71,0.08)" },
} as const;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title" style={{ marginBottom: 10 }}>{title}</div>
      <div style={{ width: "100%", height: 210 }}>{children}</div>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}