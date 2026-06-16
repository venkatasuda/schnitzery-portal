"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { getBranchAnalytics, getAnalyticsScope, getOvertimeTrend } from "@/lib/queries/branch-analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";

const GOLD = "#d4a847", BLUE = "#3498db", GREEN = "#58d68d", AMBER = "#e8a35a", RED = "#ec7063";
const TEAM_COLORS = ["#c0392b", "#3498db", "#27ae60", "#d4a847", "#9b59b6", "#e67e22"];
type Period = "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("weekly");
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState<{ canPickBranch: boolean; branches: any[]; defaultBranch?: string } | null>(null);
  const [branch, setBranch] = useState<string>("all");
  const [data, setData] = useState<any>(null);
  const [otTrend, setOtTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => { getAnalyticsScope().then((s) => { if (s.ok) { setScope(s); if (!s.canPickBranch) setBranch(s.defaultBranch || ""); } else setDenied(true); }); }, []);

  // overtime trend (6 months) — depends only on branch, not the period toggle
  useEffect(() => {
    if (!scope) return;
    getOvertimeTrend({ branchId: scope.canPickBranch ? branch : null, months: 6 }).then((r) => { if (r.ok) setOtTrend(r.trend || []); });
  }, [branch, scope]);

  const load = useCallback(() => {
    setLoading(true);
    getBranchAnalytics({ period, date: anchor, branchId: scope?.canPickBranch ? branch : null }).then((r) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, [period, anchor, branch, scope]);
  useEffect(() => { if (scope) load(); }, [load, scope]);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const m = data?.metrics;
  const clr = (v: number, dir: "up" | "down", good: number, ok: number) => dir === "up" ? (v >= good ? GREEN : v >= ok ? AMBER : RED) : (v <= good ? GREEN : v <= ok ? AMBER : RED);
  const sel: React.CSSProperties = { padding: "8px 10px", background: "var(--dark3)", color: "var(--white)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, fontSize: 13 };

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📊" size={22} /> {t("bana.title")}</div>
      <div className="page-sub">{data?.scope ? `${data.scope} · ` : ""}{t("bana.subtitle")}</div>

      {/* period toggle */}
      <div className="hub-tabs">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button key={p} className={`hub-tab${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{t(`bana.${p}`)}</button>
        ))}
      </div>

      {/* controls */}
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {period === "monthly"
          ? <input type="month" value={anchor.slice(0, 7)} onChange={(e) => setAnchor(`${e.target.value}-01`)} style={sel} />
          : <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} style={sel} />}
        {scope?.canPickBranch && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} style={sel}>
            <option value="all">{t("bana.allBranches")}</option>
            {scope.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {data && <span style={{ fontSize: 12, color: "var(--gray)", marginLeft: "auto" }}>{data.from} → {data.to}</span>}
      </div>

      {loading || !m ? (
        <div style={{ marginTop: 14 }}><StatsSkeleton count={4} /><div style={{ height: 12 }} /><Skeleton height={210} radius={14} /></div>
      ) : m.scheduled === 0 && m.laborHours === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 36, fontSize: 14, lineHeight: 1.6 }}><Icon e="📊" size={26} color="var(--gray)" /> {t("bana.noData")}</div>
      ) : (
        <>
          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
            <Kpi value={`${m.attendancePct}%`} label={t("bana.kAttendance")} color={clr(m.attendancePct, "up", 95, 85)} sub={`${m.attended}/${m.scheduled}`} />
            <Kpi value={`${m.absencePct}%`} label={t("bana.kAbsence")} color={clr(m.absencePct, "down", 5, 15)} />
            <Kpi value={`${m.latePct}%`} label={t("bana.kLate")} color={clr(m.latePct, "down", 10, 20)} />
            <Kpi value={`${m.shiftCompliancePct}%`} label={t("bana.kCompliance")} color={clr(m.shiftCompliancePct, "up", 90, 75)} />
            <Kpi value={`${m.utilizationPct}%`} label={t("bana.kUtilization")} color={clr(m.utilizationPct, "up", 90, 70)} />
            <Kpi value={`${m.overtimePct}%`} label={t("bana.kOvertime")} color={clr(m.overtimePct, "down", 10, 20)} />
            <Kpi value={`${m.laborHours}h`} label={t("bana.kLaborHours")} color={GOLD} />
            <Kpi value={m.laborCost ? `€${m.laborCost.toFixed(0)}` : "—"} label={t("bana.kLaborCost")} color={GOLD} />
          </div>

          {/* productivity */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>{t("bana.productivity")}</div>
            {m.totalSales > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Kpi value={m.salesPerLaborHour != null ? `€${m.salesPerLaborHour}` : "—"} label={t("bana.salesPerHour")} color={BLUE} />
                <Kpi value={m.laborCostPct != null ? `${m.laborCostPct}%` : "—"} label={t("bana.laborCostPct")} color={clr(m.laborCostPct ?? 0, "down", 25, 35)} />
                <Kpi value={`€${m.totalSales.toFixed(0)}`} label={t("bana.totalSales")} color={GOLD} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--gray)" }}>{t("bana.noSales")} <Link href="/labor" style={{ color: "var(--gold)", textDecoration: "none" }}>{t("bana.laborLink")}</Link></div>
            )}
          </div>

          {/* trend */}
          {data.trend.length > 1 && (
            <ChartCard title={t("bana.trendTitle")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="labor" fill={GOLD} radius={[5, 5, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* teams */}
          {data.teams.length > 0 && (
            <ChartCard title={t("bana.teamTitle")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.teams} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="team" tick={{ fontSize: 12, fill: "#cfc7c7" }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...tooltip} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
                  <Bar dataKey="hours" radius={[0, 5, 5, 0]} maxBarSize={26}>
                    {data.teams.map((_: any, i: number) => <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* executive overtime trend (6 months) */}
          {otTrend.length > 1 && (
            <ChartCard title={t("bana.otTrend")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={otTrend} margin={{ top: 8, right: 10, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9a8f8f" }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip {...tooltip} formatter={(v: any) => [`${v}%`, t("bana.kOvertime")]} />
                  <Line type="monotone" dataKey="overtimePct" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3, fill: AMBER }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

const tooltip = {
  contentStyle: { background: "#1c1414", border: "1px solid rgba(212,168,71,0.3)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#fff" }, itemStyle: { color: "#d4a847" }, cursor: { fill: "rgba(212,168,71,0.08)" },
} as const;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card" style={{ marginBottom: 14 }}><div className="card-title" style={{ marginBottom: 10 }}>{title}</div><div style={{ width: "100%", height: 210 }}>{children}</div></div>;
}
function Kpi({ value, label, color, sub }: { value: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "13px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--gray)", marginTop: 2, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}