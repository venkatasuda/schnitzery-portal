"use client";

import { berlinToday } from "@/lib/time/berlinDate";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getOpsDashboard, getOpsFilters } from "@/lib/queries/ops-dashboard";
import { CardSkeleton } from "@/components/Skeleton";

const todayStr = () => berlinToday();
const fmtClock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtFromMs = (ms?: number | null) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtLabor = (m: number) => { m = Math.max(0, Math.round(m)); return `${Math.floor(m / 60)}h ${m % 60}m`; };

export default function OpsPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [filters, setFilters] = useState<any>(null);
  const [branch, setBranch] = useState<string>("");
  const [date, setDate] = useState(todayStr());
  const [team, setTeam] = useState("");
  const [shift, setShift] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => { (async () => {
    const f = await getOpsFilters();
    if (f.ok) { setFilters(f); setBranch(f.defaultBranch || ""); }
  })(); }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getOpsDashboard({ date, branchId: branch || null, team: team || null, shift: shift || null });
    if (!res.ok && res.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    if (res.ok) setData(res);
    setLoading(false);
  }, [date, branch, team, shift]);

  useEffect(() => { load(); }, [load]);

  // live auto-refresh while viewing today
  useEffect(() => {
    if (date !== todayStr()) return;
    const iv = setInterval(() => load(true), 45000);
    return () => clearInterval(iv);
  }, [date, load]);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("ops.denied")}</div>;

  const m = data?.metrics;
  const rows: any[] = data?.rows || [];
  const statusMeta: Record<string, { key: string; color: string }> = {
    working: { key: "ops.stWorking", color: "var(--success)" },
    completed: { key: "ops.stCompleted", color: "#7f8c8d" },
    absent: { key: "ops.stAbsent", color: "var(--danger)" },
    not_checked_in: { key: "ops.stNotIn", color: "var(--warn)" },
    unscheduled: { key: "ops.stUnscheduled", color: "#5dade2" },
  };

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📡" size={22} /> {t("ops.title")}</div>
      <div className="page-sub">{t("ops.subtitle")}{data?.asOf ? ` · ${t("ops.asOf")} ${fmtClock(data.asOf)}` : ""}</div>

      {/* FILTERS */}
      <div className="workspace-toolbar">
        {filters?.branches?.length > 1 && (
          <select aria-label={t("nav.branches")} value={branch} onChange={(e) => setBranch(e.target.value)} style={sel}>
            {filters.branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input aria-label={t("ops.today")} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={sel} />
        <select aria-label={t("ops.filterDept")} value={team} onChange={(e) => setTeam(e.target.value)} style={sel}>
          <option value="">{t("ops.filterDept")}: {t("ops.all")}</option>
          {(filters?.teams || []).map((tm: string) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
        </select>
        <select aria-label={t("ops.filterShift")} value={shift} onChange={(e) => setShift(e.target.value)} style={sel}>
          <option value="">{t("ops.filterShift")}: {t("ops.all")}</option>
          {(filters?.shifts || []).map((sh: string) => <option key={sh} value={sh}>{sh}</option>)}
        </select>
        {date !== todayStr() && <button onClick={() => setDate(todayStr())} style={{ ...sel, color: "var(--gold)", cursor: "pointer" }}>{t("ops.today")}</button>}
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : !m ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24 }}>{t("ops.none")}</div>
      ) : (
        <>
          {/* METRIC CARDS */}
          <div className="workspace-stats operations-stats">
            <Metric icon="🟢" value={m.workingNow} label={t("ops.workingNow")} color="var(--success)" />
            <Metric icon="⏰" value={m.late} label={t("ops.late")} color={m.late ? "var(--warn)" : "var(--white)"} />
            <Metric icon="🚫" value={m.absent} label={t("ops.absent")} color={m.absent ? "var(--danger)" : "var(--white)"} />
            <Metric icon="⏳" value={m.notCheckedIn} label={t("ops.notCheckedIn")} color={m.notCheckedIn ? "var(--warn)" : "var(--white)"} />
            <Metric icon="👥" value={`${m.workingNow}/${m.scheduledNow}`} label={t("ops.staffing")} color="var(--white)" />
            <Metric icon="⏱️" value={fmtLabor(m.laborMins)} label={t("ops.laborHours")} color="var(--white)" />
          </div>

          {/* UTILIZATION */}
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--gray)" }}>{t("ops.utilization")}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: m.utilization >= 90 ? "var(--success)" : m.utilization >= 70 ? "var(--warn)" : "var(--danger)" }}>{m.utilization}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(128,128,128,0.18)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${m.utilization}%`, height: "100%", background: m.utilization >= 90 ? "var(--success)" : m.utilization >= 70 ? "var(--warn)" : "var(--danger)" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 8 }}>{t("ops.scheduled")}: {m.scheduledTotal} · {t("ops.completed")}: {m.completed}</div>
          </div>

          {/* WHO'S ON */}
          <div className="section-label">{t("ops.roster")}</div>
          {rows.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 22, fontSize: 13 }}>{t("ops.none")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((r) => {
                const meta = statusMeta[r.status] || statusMeta.working;
                return (
                  <div key={r.userId + r.shift} className="card" style={{ padding: 11, borderLeft: `3px solid ${meta.color}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>
                        {r.shift ? `${teamLabel(r.team)} · ${r.shift}` : (r.team ? teamLabel(r.team) : t("ops.stUnscheduled"))}
                        {r.schedStart != null && ` · ${t("ops.sched")} ${fmtFromMs(r.schedStart)}–${fmtFromMs(r.schedEnd)}`}
                        {r.clockIn && ` · ${t("ops.actual")} ${fmtClock(r.clockIn)}–${fmtClock(r.clockOut)}`}
                      </div>
                    </div>
                    {r.lateMins > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)", background: "rgba(232,163,90,0.15)", padding: "2px 7px", borderRadius: 12 }}>+{r.lateMins}m</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: "var(--dark2)", padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{t(meta.key)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 16, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← {t("dash.title")}</Link>
    </div>
  );
}

function Metric({ icon, value, label, color }: { icon: string; value: any; label: string; color: string }) {
  return (
    <div className="workspace-stat">
      <strong style={{ color }}>{value}</strong>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e={icon} size={16} />{label}</span>
    </div>
  );
}

const sel: React.CSSProperties = { padding: "8px 10px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.22)", borderRadius: 10, color: "var(--white)", fontSize: 12.5, fontWeight: 600 };