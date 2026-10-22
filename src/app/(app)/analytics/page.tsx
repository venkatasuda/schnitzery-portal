"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { getBranchAnalytics, getAnalyticsScope, getOvertimeTrend, getStaffPerformance } from "@/lib/queries/branch-analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";
import BusinessOverview from "@/components/BusinessOverview";
import { berlinToday } from "@/lib/time/berlinDate";
import { Stat } from "@/components/ui";

const GOLD = "var(--gold-ink)", BLUE = "var(--info)", GREEN = "var(--success)", AMBER = "var(--warn)", RED = "var(--danger)";
const TEAM_COLORS = ["#c0392b", "#3498db", "#27ae60", "#d4a847", "#9b59b6", "#e67e22"];
type Period = "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("weekly");
  const [anchor, setAnchor] = useState(berlinToday);
  const [view, setView] = useState("business");
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [scope, setScope] = useState<{ canPickBranch: boolean; branches: any[]; defaultBranch?: string | null } | null>(null);
  const [branch, setBranch] = useState<string>("all");
  const [data, setData] = useState<any>(null);
  const [otTrend, setOtTrend] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [today, setToday] = useState<any>(null);
  const [swaps, setSwaps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => { getAnalyticsScope().then((s) => { if (s.ok) { setScope(s); if (!s.canPickBranch) setBranch(s.defaultBranch || ""); } else { setDenied(true); setLoading(false); } }).catch(() => { setError(t("assistant.error")); setLoading(false); }); }, [t]);

  // overtime trend (6 months) — depends only on branch, not the period toggle
  useEffect(() => {
    if (!scope || view !== "workforce") return;
    let cancelled = false;
    getOvertimeTrend({ branchId: scope.canPickBranch ? branch : null, months: 6 }).then((r) => { if (!cancelled) setOtTrend(r.ok ? r.trend || [] : []); }).catch(() => { if (!cancelled) setOtTrend([]); });
    getBranchAnalytics({ period: "daily", branchId: scope.canPickBranch ? branch : null }).then((r) => { if (!cancelled) setToday(r.ok ? r : null); }).catch(() => { if (!cancelled) setToday(null); });
    return () => { cancelled = true; };
  }, [branch, scope, view]);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setData(null);
    setError("");
    getBranchAnalytics({ period, date: anchor, branchId: scope?.canPickBranch ? branch : null }).then((r) => {
      if (id !== requestId.current) return;
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      else setError(r.error || t("assistant.error"));
      setLoading(false);
    }).catch(() => { if (id === requestId.current) { setError(t("assistant.error")); setLoading(false); } });
    if (view === "workforce") getStaffPerformance({ period, date: anchor, branchId: scope?.canPickBranch ? branch : null }).then((r) => { if (id === requestId.current) { setStaff(r.ok ? r.rows : []); setSwaps(r.ok ? (r.swapCount || 0) : 0); } }).catch(() => { if (id === requestId.current) setStaff([]); });
  }, [period, anchor, branch, scope, view, t]);
  useEffect(() => { if (scope) load(); }, [load, scope]);

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const m = data?.metrics;
  const clr = (v: number, dir: "up" | "down", good: number, ok: number) => dir === "up" ? (v >= good ? GREEN : v >= ok ? AMBER : RED) : (v <= good ? GREEN : v <= ok ? AMBER : RED);
  const teamRows: any[] = Object.values(staff.reduce((acc: any, s: any) => { const k = s.team || "—"; (acc[k] = acc[k] || { team: k, hours: 0, cost: 0, partial: false }); acc[k].hours += s.totalHours; acc[k].cost += s.cost ?? 0; acc[k].partial ||= s.cost == null; return acc; }, {})).sort((a: any, b: any) => b.cost - a.cost);
  const mostWorked = staff.reduce((m: any, s: any) => (s.totalHours > (m?.totalHours ?? -1) ? s : m), null as any);
  const topOT = staff.reduce((m: any, s: any) => (s.otHours > (m?.otHours ?? -1) ? s : m), null as any);
  const missedTotal = staff.reduce((n: number, s: any) => n + (s.absent || 0), 0);

  return (
    <div className="fade-up analytics-workspace">
      <h1 className="page-title u-row"><Icon e="📊" size={22} /> {t("business.performance")}</h1>
      <div className="page-sub">{data?.scope ? `${data.scope} · ` : ""}{t("bana.subtitle")}</div>

      <div className="hub-tabs" role="group" aria-label={t("business.reportView")}>
        {["business", "workforce"].map(v => <button key={v} aria-pressed={view === v} className={`hub-tab${view === v ? " active" : ""}`} onClick={() => setView(v)}>{t(`business.${v}`)}</button>)}
      </div>
      <div className="report-controls">
      <div className="hub-tabs" role="group" aria-label={t("business.reportPeriod")}>
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button key={p} aria-pressed={period === p} className={`hub-tab${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{t(`bana.${p}`)}</button>
        ))}
      </div>

      {/* controls */}
      <label>{t("business.reportDate")}
        {period === "monthly"
          ? <input type="month" className="form-input" value={anchor.slice(0, 7)} onChange={(e) => setAnchor(`${e.target.value}-01`)} />
          : <input type="date" className="form-input" value={anchor} onChange={(e) => setAnchor(e.target.value)} />}
      </label>
        {scope?.canPickBranch && (
          <label>{t("business.reportBranch")}<select className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="all">{t("bana.allBranches")}</option>
            {scope.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
        )}
        {data && <span>{data.from} → {data.to}</span>}
      </div>

      {view === "workforce" && today?.ok && (
        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Icon e="📅" size={14} color="var(--gold)" /> {t("bana.today")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            <Stat value={today.metrics.totalSales ? `€${today.metrics.totalSales.toFixed(0)}` : "—"} label={t("bana.totalSales")} color={GOLD} />
            <Stat value={`${today.metrics.attended}/${today.metrics.scheduled}`} label={t("bana.present")} color={GOLD} />
            <Stat value={`${today.metrics.attendancePct}%`} label={t("bana.kAttendance")} color={clr(today.metrics.attendancePct, "up", 95, 85)} />
            <Stat value={today.metrics.laborCost ? `${today.business.coverage.labor.complete ? "" : "≥ "}€${today.metrics.laborCost.toFixed(0)}` : "—"} label={t("bana.kLaborCost")} color={GOLD} />
            <Stat value={`${today.metrics.latePct}%`} label={t("bana.kLate")} color={clr(today.metrics.latePct, "down", 10, 20)} />
            <Stat value={today.metrics.laborCostPct != null ? `${today.metrics.laborCostPct}%` : "—"} label={t("bana.laborCostPct")} color={GOLD} />
          </div>
        </div>
      )}


      {error && <div className="business-note" role="alert">{error}<button className="btn-secondary" onClick={load}>{t("business.retry")}</button></div>}
      {view === "business" && loading && <div role="status" aria-label={t("common.loading")}><StatsSkeleton count={4} /><Skeleton height={210} radius={12} /></div>}
      {view === "business" && !loading && data?.ok && <BusinessOverview data={data} />}
      <div hidden={view !== "workforce"} className="workforce-report">
      {loading ? (
        <div style={{ marginTop: 14 }}><StatsSkeleton count={4} /><div style={{ height: 12 }} /><Skeleton height={210} radius={14} /></div>
      ) : !m || m.scheduled === 0 && m.laborHours === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 36, fontSize: 14, lineHeight: 1.6 }}><Icon e="📊" size={26} color="var(--gray)" /> {t("bana.noData")}</div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="report-metrics">
            <Stat value={`${m.attendancePct}%`} label={t("bana.kAttendance")} color={clr(m.attendancePct, "up", 95, 85)} sub={`${m.attended}/${m.scheduled}`} />
            <Stat value={`${m.absencePct}%`} label={t("bana.kAbsence")} color={clr(m.absencePct, "down", 5, 15)} />
            <Stat value={`${m.latePct}%`} label={t("bana.kLate")} color={clr(m.latePct, "down", 10, 20)} />
            <Stat value={`${m.shiftCompliancePct}%`} label={t("bana.kCompliance")} color={clr(m.shiftCompliancePct, "up", 90, 75)} />
            <Stat value={`${m.utilizationPct}%`} label={t("bana.kUtilization")} color={clr(m.utilizationPct, "up", 90, 70)} />
            <Stat value={`${m.overtimePct}%`} label={t("bana.kOvertime")} color={clr(m.overtimePct, "down", 10, 20)} />
            <Stat value={`${m.laborHours}h`} label={t("bana.kLaborHours")} color={GOLD} />
            <Stat value={m.laborCost ? `${data.business.coverage.labor.complete ? "" : "≥ "}€${m.laborCost.toFixed(0)}` : "—"} label={t("bana.kLaborCost")} color={GOLD} />
          </div>

          {/* productivity */}
          <div className="card u-mb-4">
            <div className="card-title" style={{ marginBottom: 10 }}>{t("bana.productivity")}</div>
            {m.totalSales > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                <Stat value={m.salesPerLaborHour != null ? `€${m.salesPerLaborHour}` : "—"} label={t("bana.salesPerHour")} color={BLUE} />
                <Stat value={m.laborCostPct != null ? `${m.laborCostPct}%` : "—"} label={t("bana.laborCostPct")} color={clr(m.laborCostPct ?? 0, "down", 25, 35)} />
                <Stat value={`€${m.totalSales.toFixed(0)}`} label={t("bana.totalSales")} color={GOLD} />
              </div>
            ) : (
              <div className="ui-muted-md">{t("bana.noSales")} <Link href="/labor" style={{ color: "var(--gold-ink)", textDecoration: "none" }}>{t("bana.laborLink")}</Link></div>
            )}
          </div>

          {/* trend */}
          {data.trend.length > 1 && (
            <ChartCard title={t("bana.trendTitle")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
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
                  <XAxis type="number" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
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
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip {...tooltip} formatter={(v: any) => [`${v}%`, t("bana.kOvertime")]} />
                  <Line type="monotone" dataKey="overtimePct" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3, fill: AMBER }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}

      {!loading && data?.ok && (
        <div className="card u-mb-4">
          <div className="card-title" style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="👥" size={16} /> {t("bana.staffPerf")}</div>
          <div style={{ fontSize: 10.5, color: "var(--gray)", marginBottom: 10 }}>{t("bana.staffPerfHint")}</div>
          {staff.length === 0 ? (
            <div style={{ color: "var(--gray)", fontSize: 12, textAlign: "center", padding: "14px 0" }}>{t("bana.noStaffData")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", fontWeight: 600 }}>{t("bana.colEmployee")}</th>
                    <th className="u-center u-semibold" scope="col">{t("bana.colAtt")}</th>
                    <th className="u-center u-semibold" scope="col">{t("bana.colLate")}</th>
                    <th scope="col" style={{ textAlign: "right", fontWeight: 600 }}>{t("bana.colHours")}</th>
                    <th scope="col" style={{ textAlign: "right", fontWeight: 600 }}>{t("bana.colCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const att = s.attendancePct as number | null;
                    const attColor = att == null ? "var(--gray)" : att >= 90 ? "var(--success)" : att >= 80 ? "var(--warn)" : "var(--danger)";
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td>
                          <div className="ui-strong-inline">{s.name}</div>
                          <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "capitalize" }}>{s.team}</div>
                        </td>
                        <td style={{ textAlign: "center", color: attColor, fontWeight: 700 }}>{att == null ? "—" : `${att}%`}</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ color: s.late > 0 ? "var(--warn)" : "var(--white)", fontWeight: 600 }}>{s.late}</span>
                          {s.absent > 0 && <span style={{ fontSize: 12, color: "var(--danger)", marginLeft: 5 }}>{s.absent} {t("bana.absShort")}</span>}
                        </td>
                        <td className="u-right">
                          <div className="ui-strong-inline">{s.totalHours}h</div>
                          {s.avgShiftHours > 0 && <div className="ui-muted">{t("bana.avgShort")} {s.avgShiftHours}h</div>}
                        </td>
                        <td className="u-right">
                          <div style={{ color: "var(--gold-ink)", fontWeight: 600 }}>{s.cost ? `€${s.cost.toFixed(0)}` : "—"}</div>
                          {s.otHours > 0 && <div style={{ fontSize: 12, color: "var(--warn)" }}>+{s.otHours}h OT</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && staff.length > 0 && (
        <div className="card u-mb-4">
          <div className="card-title" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon e="💶" size={16} color="var(--gold)" /> {t("bana.laborByTeam")}</div>
          <div className="table-scroll" role="region" aria-label={t("workspace.table")} tabIndex={0}><table className="data-table">
            <thead><tr>
              <th scope="col" style={{ textAlign: "left", fontWeight: 600 }}>{t("bana.colTeam")}</th>
              <th className="u-center u-semibold" scope="col">{t("bana.colHours")}</th>
              <th scope="col" style={{ textAlign: "right", fontWeight: 600 }}>{t("bana.colCost")}</th>
            </tr></thead>
            <tbody>
              {teamRows.map((tr: any) => (
                <tr key={tr.team} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ color: "var(--white)", fontWeight: 600, textTransform: "capitalize" }}>{tr.team}</td>
                  <td style={{ textAlign: "center", color: "var(--white)" }}>{tr.hours.toFixed(1)}h</td>
                  <td style={{ textAlign: "right", color: "var(--gold-ink)", fontWeight: 600 }}>{tr.partial ? "≥ " : ""}€{tr.cost.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {!loading && staff.length > 0 && (
        <div className="card u-mb-4">
          <div className="card-title" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon e="🗓️" size={16} color="var(--gold)" /> {t("bana.shiftStats")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <Stat value={mostWorked ? `${mostWorked.totalHours}h` : "—"} label={t("bana.mostWorked")} color={GOLD} sub={mostWorked ? mostWorked.name : undefined} />
            <Stat value={topOT && topOT.otHours > 0 ? `${topOT.otHours}h` : "—"} label={t("bana.topOvertime")} color={topOT && topOT.otHours > 0 ? "var(--warn)" : "var(--gray)"} sub={topOT && topOT.otHours > 0 ? topOT.name : undefined} />
            <Stat value={swaps} label={t("bana.swaps")} color={GOLD} />
            <Stat value={missedTotal} label={t("bana.missed")} color={missedTotal > 0 ? "var(--danger)" : "var(--success)"} />
          </div>
        </div>
      )}

      </div>
      {view === "business" && loading && <StatsSkeleton count={4} />}
    </div>
  );
}

const tooltip = {
  contentStyle: { background: "var(--dark)", border: "1px solid var(--accent-line)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--white)" }, itemStyle: { color: "var(--gold-ink)" }, cursor: { fill: "var(--accent-soft)" },
} as const;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card u-mb-4"><div className="card-title" style={{ marginBottom: 10 }}>{title}</div><div style={{ width: "100%", height: 210 }}>{children}</div></div>;
}
