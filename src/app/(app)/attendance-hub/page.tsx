"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";
import {
  getLiveAttendance, getMonthlyOvertime, getAttendanceApprovals, setAttendanceApproval,
} from "@/lib/queries/live-attendance";

type Tab = "live" | "approval" | "overtime" | "noshow" | "display";

const fmtH = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }) : "—";

export default function AttendanceHubPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [tab, setTab] = useState<Tab>("live");
  const [denied, setDenied] = useState(false);

  // ── LIVE ──
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({ workingNow: 0, completed: 0, late: 0, totalMins: 0 });
  const [liveLoading, setLiveLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // ── OVERTIME ──
  const [month, setMonth] = useState("");
  const [otRows, setOtRows] = useState<any[]>([]);
  const [otLong, setOtLong] = useState<any[]>([]);
  const [otStats, setOtStats] = useState({ peopleOver: 0, totalOvertimeMins: 0, totalWorkedMins: 0 });
  const [otLoading, setOtLoading] = useState(false);
  const [otLoaded, setOtLoaded] = useState(false);

  // ── APPROVALS ──
  const [appRows, setAppRows] = useState<any[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appLoaded, setAppLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadLive(d: string) {
    setLiveLoading(true);
    const res = await getLiveAttendance(d || undefined);
    if (res.ok) {
      setRows(res.rows || []);
      setStats({ workingNow: res.workingNow || 0, completed: res.completed || 0, late: res.late || 0, totalMins: res.totalMins || 0 });
    } else if (res.error?.includes("Managers")) setDenied(true);
    setLiveLoading(false);
  }

  async function loadOvertime(m: string) {
    setOtLoading(true);
    const res = await getMonthlyOvertime(m || undefined);
    if (res.ok) {
      setOtRows(res.rows || []);
      setOtLong(res.longShifts || []);
      setOtStats({ peopleOver: res.peopleOver || 0, totalOvertimeMins: res.totalOvertimeMins || 0, totalWorkedMins: res.totalWorkedMins || 0 });
    } else if (res.error?.includes("Managers")) setDenied(true);
    setOtLoading(false);
    setOtLoaded(true);
  }

  async function loadApprovals() {
    setAppLoading(true);
    const res = await getAttendanceApprovals();
    if (res.ok) setAppRows(res.rows || []);
    else if (res.error?.includes("Managers")) setDenied(true);
    setAppLoading(false);
    setAppLoaded(true);
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const res = await setAttendanceApproval(id, status);
    if (res.ok) setAppRows((rs) => rs.filter((r) => r.id !== id));
    setBusyId(null);
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
    setMonth(today.slice(0, 7));
    loadLive(today);
  }, []);

  function openTab(t: Tab) {
    setTab(t);
    if (t === "overtime" && !otLoaded) loadOvertime(month || new Date().toISOString().slice(0, 7));
    if (t === "approval" && !appLoaded) loadApprovals();
  }
  function changeDate(d: string) { setDate(d); loadLive(d); }
  function goToday() { const t = new Date().toISOString().slice(0, 10); setDate(t); loadLive(t); }
  function changeMonth(m: string) { setMonth(m); loadOvertime(m); }

  const liveHours = fmtH(stats.totalMins);
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));
  const isToday = date === new Date().toISOString().slice(0, 10);

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("common.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <div className="page-title">🕐 {t("nav.attendance")}</div>
      <div className="page-sub">{t("ahub.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "live" ? " active" : ""}`} onClick={() => openTab("live")}>{t("ahub.tabLive")}</button>
        <button className={`hub-tab${tab === "approval" ? " active" : ""}`} onClick={() => openTab("approval")}>{t("ahub.tabApproval")}</button>
        <button className={`hub-tab${tab === "overtime" ? " active" : ""}`} onClick={() => openTab("overtime")}>{t("ahub.tabOvertime")}</button>
        <button className={`hub-tab${tab === "noshow" ? " active" : ""}`} onClick={() => openTab("noshow")}>{t("ahub.tabNoshow")}</button>
        <button className={`hub-tab${tab === "display" ? " active" : ""}`} onClick={() => openTab("display")}>{t("ahub.tabDisplay")}</button>
      </div>

      {/* ───────── LIVE ───────── */}
      {tab === "live" && (
        <div className="hub-tab-panel active">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Stat value={stats.workingNow} label={t("home.statWorking")} color="#58d68d" />
            <Stat value={stats.completed} label={t("ahub.completed")} color="var(--white)" />
            <Stat value={stats.late} label={t("home.statLate")} color={stats.late > 0 ? "#ec7063" : "var(--white)"} />
            <Stat value={liveHours} label={t("home.hours")} color="var(--gold)" />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} style={dateInput} />
            <button onClick={goToday} style={{ ...todayBtn, opacity: isToday ? 0.6 : 1 }}>{t("ahub.today")}</button>
          </div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("ahub.filterName")} style={filterInput} />
          {liveLoading ? (
            <div style={{ color: "var(--gray)", fontSize: 13, padding: 24, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto 10px" }} />{t("common.loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 26, fontSize: 13 }}>
              {rows.length === 0 ? (isToday ? t("ahub.noClockedIn") : t("ahub.noAttendance")) : t("ahub.noMatch")}
            </div>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {filtered.map((r, i) => {
                const live = r.status === "active" || r.status === "on-break";
                const dotColor = r.status === "on-break" ? "#e8a35a" : live ? "#58d68d" : "var(--gray)";
                const statusText = r.status === "on-break" ? t("ahub.onBreak") : live ? t("ahub.statusWorking") : t("ahub.statusDone");
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0, boxShadow: live ? `0 0 8px ${dotColor}` : "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{r.name}{r.late_mins > 0 && <span style={{ fontSize: 10, color: "#ec7063", marginLeft: 8 }}>⚠ {t("ahub.mLate", { n: r.late_mins })}</span>}</div>
                      <div style={{ fontSize: 11, color: "var(--gray)" }}>{r.team ? teamLabel(r.team) : "—"} · {statusText}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}</div>
                      {r.duration_mins != null && <div style={{ fontSize: 11, color: "var(--gray)" }}>{fmtH(r.duration_mins)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/attendance" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 13, color: "var(--gold)", textDecoration: "none" }}>{t("ahub.myClock")}</Link>
        </div>
      )}

      {/* ───────── APPROVAL ───────── */}
      {tab === "approval" && (
        <div className="hub-tab-panel active">
          <div className="page-sub" style={{ marginBottom: 12 }}>{t("ahub.signOff")}</div>
          {appLoading ? (
            <div style={{ color: "var(--gray)", fontSize: 13, padding: 24, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…</div>
          ) : appRows.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>{t("ahub.allCaughtUp")}
            </div>
          ) : (
            appRows.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                    {r.name}
                    {r.overtime && <span style={{ fontSize: 10, color: "#e8a35a", marginLeft: 8 }}>⏱ {t("approvals.overtime")}</span>}
                    {r.late_mins > 0 && <span style={{ fontSize: 10, color: "#ec7063", marginLeft: 8 }}>⚠ {t("ahub.mLate", { n: r.late_mins })}</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{fmtH(r.duration_mins || 0)}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 10 }}>
                  {fmtDate(r.work_date)} · {r.team ? teamLabel(r.team) : "—"} · {fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => decide(r.id, "approved")} disabled={busyId === r.id} style={approveBtn}>{busyId === r.id ? "…" : t("ahub.approve")}</button>
                  <button onClick={() => decide(r.id, "rejected")} disabled={busyId === r.id} style={rejectBtn}>{t("ahub.reject")}</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ───────── OVERTIME ───────── */}
      {tab === "overtime" && (
        <div className="hub-tab-panel active">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input type="month" value={month} onChange={(e) => changeMonth(e.target.value)} style={dateInput} />
          </div>

          {otLoading ? (
            <div style={{ color: "var(--gray)", fontSize: 13, padding: 24, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…</div>
          ) : (
            <>
              {/* summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <Stat value={otStats.peopleOver} label={t("home.overContract")} color={otStats.peopleOver > 0 ? "#e8a35a" : "#58d68d"} />
                <Stat value={fmtH(otStats.totalOvertimeMins)} label={t("ahub.totalOvertime")} color={otStats.totalOvertimeMins > 0 ? "#e8a35a" : "var(--white)"} />
              </div>

              {otRows.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>{t("ahub.noHoursMonth")}</div>
              ) : (
                <div className="card">
                  <div className="card-title">{t("ahub.contractVsWorked")}</div>
                  {otRows.map((r, i) => {
                    const over = r.overtimeMins > 0;
                    const pct = r.contractHours > 0 ? Math.min(100, Math.round((r.workedMins / (r.contractHours * 60)) * 100)) : 0;
                    return (
                      <div key={r.user_id} style={{ padding: "11px 0", borderBottom: i < otRows.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{r.name} <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 400 }}>· {r.team ? teamLabel(r.team) : "—"}</span></div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: over ? "#e8a35a" : "#58d68d" }}>{over ? `+${fmtH(r.overtimeMins)}` : t("ahub.within")}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 3 }}>
                          {t("ahub.workedContract", { w: fmtH(r.workedMins), c: r.contractHours, s: r.shifts })}{r.contractType ? ` · ${r.contractType}` : ""}
                        </div>
                        {/* progress bar: normal (gold) + overtime (orange) */}
                        <div style={{ height: 6, background: "rgba(128,128,128,0.15)", borderRadius: 4, marginTop: 7, overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, background: over ? "#e8a35a" : "var(--gold)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* long shifts */}
              {otLong.length > 0 && (
                <div className="card">
                  <div className="card-title">{t("ahub.longShifts")}</div>
                  {otLong.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < otLong.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none", fontSize: 13 }}>
                      <span style={{ color: "var(--white)" }}>{l.name} <span style={{ color: "var(--gray)", fontSize: 11 }}>· {fmtDate(l.work_date)}</span></span>
                      <span style={{ color: "#e8a35a", fontWeight: 600 }}>{fmtH(l.mins)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ───────── NO-SHOWS ───────── */}
      {tab === "noshow" && (
        <div className="hub-tab-panel active">
          <Link href="/noshow" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#b9770e,#e67e22)" }}>🚫</div>
            <div style={{ flex: 1 }}><div className="feature-title">{t("ahub.noShowTracking")}</div><div className="feature-sub">{t("ahub.noShowTrackingSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            {t("ahub.noShowHint")}
          </div>
        </div>
      )}

      {/* ───────── DISPLAY ───────── */}
      {tab === "display" && (
        <div className="hub-tab-panel active">
          <Link href="/clock-display" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}>📲</div>
            <div style={{ flex: 1 }}><div className="feature-title">{t("ahub.clockDisplayScreen")}</div><div className="feature-sub">{t("ahub.clockDisplayScreenSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            {t("ahub.displayHint")}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.12)", borderRadius: 10, padding: "12px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

const dateInput: React.CSSProperties = { flex: 1, padding: "10px 12px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const todayBtn: React.CSSProperties = { padding: "10px 16px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const filterInput: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 14, boxSizing: "border-box", marginBottom: 12 };
const approveBtn: React.CSSProperties = { flex: 1, padding: "10px", background: "linear-gradient(135deg,#1e8449,#27ae60)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const rejectBtn: React.CSSProperties = { flex: 1, padding: "10px", background: "transparent", color: "#ec7063", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" };