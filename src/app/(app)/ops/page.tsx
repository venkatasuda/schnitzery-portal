"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getOpsDashboard, getOpsFilters } from "@/lib/queries/ops-dashboard";
import { CardSkeleton } from "@/components/Skeleton";

const todayStr = () => new Date().toISOString().slice(0, 10);
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
    working: { key: "ops.stWorking", color: "#58d68d" },
    completed: { key: "ops.stCompleted", color: "#7f8c8d" },
    absent: { key: "ops.stAbsent", color: "#ec7063" },
    not_checked_in: { key: "ops.stNotIn", color: "#e8a35a" },
    unscheduled: { key: "ops.stUnscheduled", color: "#5dade2" },
  };

  return (
    <div className="fade-up">
      <div className="page-title">📡 {t("ops.title")}</div>
      <div className="page-sub">{t("ops.subtitle")}{data?.asOf ? ` · ${t("ops.asOf")} ${fmtClock(data.asOf)}` : ""}</div>

      {/* FILTERS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {filters?.branches?.length > 1 && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} style={sel}>
            {filters.branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={sel} />
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={sel}>
          <option value="">{t("ops.filterDept")}: {t("ops.all")}</option>
          {(filters?.teams || []).map((tm: string) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
        </select>
        <select value={shift} onChange={(e) => setShift(e.target.value)} style={sel}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 8, marginBottom: 14 }}>
            <Metric icon="🟢" value={m.workingNow} label={t("ops.workingNow")} color="#58d68d" />
            <Metric icon="⏰" value={m.late} label={t("ops.late")} color={m.late ? "#e8a35a" : "var(--white)"} />
            <Metric icon="🚫" value={m.absent} label={t("ops.absent")} color={m.absent ? "#ec7063" : "var(--white)"} />
            <Metric icon="⏳" value={m.notCheckedIn} label={t("ops.notCheckedIn")} color={m.notCheckedIn ? "#e8a35a" : "var(--white)"} />
            <Metric icon="👥" value={`${m.workingNow}/${m.scheduledNow}`} label={t("ops.staffing")} color="#3498db" />
            <Metric icon="⏱️" value={fmtLabor(m.laborMins)} label={t("ops.laborHours")} color="#d4a847" />
          </div>

          {/* UTILIZATION */}
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--gray)" }}>{t("ops.utilization")}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: m.utilization >= 90 ? "#58d68d" : m.utilization >= 70 ? "#e8a35a" : "#ec7063" }}>{m.utilization}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(128,128,128,0.18)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${m.utilization}%`, height: "100%", background: m.utilization >= 90 ? "#58d68d" : m.utilization >= 70 ? "#e8a35a" : "#ec7063" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>{t("ops.scheduled")}: {m.scheduledTotal} · {t("ops.completed")}: {m.completed}</div>
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
                      <div style={{ fontSize: 11, color: "var(--gray)" }}>
                        {r.shift ? `${teamLabel(r.team)} · ${r.shift}` : (r.team ? teamLabel(r.team) : t("ops.stUnscheduled"))}
                        {r.schedStart != null && ` · ${t("ops.sched")} ${fmtFromMs(r.schedStart)}–${fmtFromMs(r.schedEnd)}`}
                        {r.clockIn && ` · ${t("ops.actual")} ${fmtClock(r.clockIn)}–${fmtClock(r.clockOut)}`}
                      </div>
                    </div>
                    {r.lateMins > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#e8a35a", background: "rgba(232,163,90,0.15)", padding: "2px 7px", borderRadius: 12 }}>+{r.lateMins}m</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: `${meta.color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{t(meta.key)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link href="/dashboard" style={{ display: "block", textAlign: "center", marginTop: 16, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← {t("dash.title")}</Link>
    </div>
  );
}

function Metric({ icon, value, label, color }: { icon: string; value: any; label: string; color: string }) {
  return (
    <div className="card" style={{ padding: 12, textAlign: "center" }}>
      <div style={{ fontSize: 15, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--gray)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

const sel: React.CSSProperties = { padding: "8px 10px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.22)", borderRadius: 10, color: "var(--white)", fontSize: 12.5, fontWeight: 600 };