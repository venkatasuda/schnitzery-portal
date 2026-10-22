"use client";

import { berlinToday, berlinMonth } from "@/lib/time/berlinDate";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import OfflineReview from "@/components/OfflineReview";
import {
  getLiveAttendance, getMonthlyOvertime, getAttendanceApprovals, setAttendanceApproval,
} from "@/lib/queries/live-attendance";
import { Stat } from "@/components/ui";

type Tab = "live" | "approval" | "overtime" | "noshow" | "offline";

const fmtH = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }) : "—";

export default function AttendanceHubPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [tab, setTab] = useState<Tab>("live");
  const [denied, setDenied] = useState(false);
  const [readError,setReadError]=useState(false);
  const requests=useRef({live:0,overtime:0,approval:0});

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

  // ── APPROVALS ──
  const [appRows, setAppRows] = useState<any[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadLive(d: string) {
    const serial=++requests.current.live;
    setReadError(false); setLiveLoading(true);
    try {
      const res=await getLiveAttendance(d||undefined);
      if(serial!==requests.current.live)return;
      if(!res.ok){if(res.error?.includes("Managers"))setDenied(true);throw Error();}
      setRows(res.rows||[]);
      setStats({workingNow:res.workingNow||0,completed:res.completed||0,late:res.late||0,totalMins:res.totalMins||0});
    }catch{if(serial===requests.current.live)setReadError(true);}
    finally{if(serial===requests.current.live)setLiveLoading(false);}
  }
  async function loadOvertime(m: string) {
    const serial=++requests.current.overtime;
    setReadError(false);setOtLoading(true);
    try{
      const res=await getMonthlyOvertime(m||undefined);
      if(serial!==requests.current.overtime)return;
      if(!res.ok){if(res.error?.includes("Managers"))setDenied(true);throw Error();}
      setOtRows(res.rows||[]);setOtLong(res.longShifts||[]);
      setOtStats({peopleOver:res.peopleOver||0,totalOvertimeMins:res.totalOvertimeMins||0,totalWorkedMins:res.totalWorkedMins||0});
    }catch{if(serial===requests.current.overtime)setReadError(true);}
    finally{if(serial===requests.current.overtime){setOtLoading(false);}}
  }
  async function loadApprovals() {
    const serial=++requests.current.approval;
    setReadError(false);setAppLoading(true);
    try{
      const res=await getAttendanceApprovals();
      if(serial!==requests.current.approval)return;
      if(!res.ok){if(res.error?.includes("Managers"))setDenied(true);throw Error();}
      setAppRows(res.rows||[]);
    }catch{if(serial===requests.current.approval)setReadError(true);}
    finally{if(serial===requests.current.approval){setAppLoading(false);}}
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    try {const res = await setAttendanceApproval(id, status);
    if (res.ok) setAppRows((rs) => rs.filter((r) => r.id !== id));
    else setReadError(true);
    }catch{setReadError(true);}finally{setBusyId(null);}
  }

  useEffect(() => {
    const today = berlinToday();
    setDate(today);
    setMonth(today.slice(0, 7));
    loadLive(today);
    return()=>{requests.current.live++;requests.current.overtime++;requests.current.approval++;};
  }, []);

  function openTab(t: Tab) {
    requests.current.live++;requests.current.overtime++;requests.current.approval++;
    setReadError(false);setTab(t);
    if (t === "live") loadLive(date);
    if (t === "overtime") loadOvertime(month || berlinMonth());
    if (t === "approval") loadApprovals();
  }
  function changeDate(d: string) { setDate(d); loadLive(d); }
  function goToday() { const t = berlinToday(); setDate(t); loadLive(t); }
  function changeMonth(m: string) { setMonth(m); loadOvertime(m); }

  const liveHours = fmtH(stats.totalMins);
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));
  const isToday = date === berlinToday();

  if (denied) {
    return <div className="card ui-denied">{t("common.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🕐" size={22} /> {t("nav.attendance")}</h1>
      <div className="page-sub">{t("ahub.subtitle")}</div>

      <div className="hub-tabs" role="group" aria-label={t("nav.attendance")}>
        <button aria-pressed={tab === "live"} className={`hub-tab${tab === "live" ? " active" : ""}`} onClick={() => openTab("live")}>{t("ahub.tabLive")}</button>
        <button aria-pressed={tab === "approval"} className={`hub-tab${tab === "approval" ? " active" : ""}`} onClick={() => openTab("approval")}>{t("ahub.tabApproval")}</button>
        <button aria-pressed={tab === "overtime"} className={`hub-tab${tab === "overtime" ? " active" : ""}`} onClick={() => openTab("overtime")}>{t("ahub.tabOvertime")}</button>
        <button aria-pressed={tab === "noshow"} className={`hub-tab${tab === "noshow" ? " active" : ""}`} onClick={() => openTab("noshow")}>{t("ahub.tabNoshow")}</button>
        <button aria-pressed={tab === "offline"} className={`hub-tab${tab === "offline" ? " active" : ""}`} onClick={() => openTab("offline")}>{t("offlineReview.title")}</button>
      </div>
      {tab === "offline" && <OfflineReview manager />}
      {readError&&<p role="alert">{t("offlineReview.failed")} <button className="btn-secondary" onClick={()=>{if(tab==="live")loadLive(date);else if(tab==="overtime")loadOvertime(month);else loadApprovals();}}>{t("business.retry")}</button></p>}

      {/* ───────── LIVE ───────── */}
      {tab === "live" && !readError && (
        <div className="hub-tab-panel active">
          <div className="workspace-stats">
            <Stat value={stats.workingNow} label={t("home.statWorking")} color="var(--success)" />
            <Stat value={stats.completed} label={t("ahub.completed")} color="var(--white)" />
            <Stat value={stats.late} label={t("home.statLate")} color={stats.late > 0 ? "var(--danger)" : "var(--white)"} />
            <Stat value={liveHours} label={t("home.hours")} color="var(--gold)" />
          </div>
          <div className="workspace-toolbar">
            <input className="form-input u-flex1" aria-label={t("ahub.today")} type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
            <button onClick={goToday} style={{ ...todayBtn, opacity: isToday ? 0.6 : 1 }}>{t("ahub.today")}</button>
          </div>
          <input className="form-input" aria-label={t("ahub.filterName")} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("ahub.filterName")} />
          {liveLoading ? (
            <div className="ui-empty-msg"><div className="spinner spinner-center" />{t("common.loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="card ui-empty-msg">
              {rows.length === 0 ? (isToday ? t("ahub.noClockedIn") : t("ahub.noAttendance")) : t("ahub.noMatch")}
            </div>
          ) : (
            <div className="card p-2">
              {filtered.map((r, i) => {
                const live = r.status === "active" || r.status === "on-break";
                const dotColor = r.status === "on-break" ? "var(--warn)" : live ? "var(--success)" : "var(--gray)";
                const statusText = r.status === "on-break" ? t("ahub.onBreak") : live ? t("ahub.statusWorking") : t("ahub.statusDone");
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0, boxShadow: live ? `0 0 8px ${dotColor}` : "none" }} />
                    <div className="u-grow">
                      <div className="ui-strong">{r.name}{r.late_mins > 0 && <span className="t-xs tone-danger ml-2"><Icon e="⚠" size={11} /> {t("ahub.mLate", { n: r.late_mins })}</span>}</div>
                      <div className="ui-muted">{r.team ? teamLabel(r.team) : "—"} · {statusText}</div>
                    </div>
                    <div className="u-right">
                      <div className="t-sm tone-action fw-6">{fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}</div>
                      {r.duration_mins != null && <div className="ui-muted">{fmtH(r.duration_mins)}</div>}
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
      {tab === "approval" && !readError && (
        <div className="hub-tab-panel active">
          <div className="page-sub u-mb-3">{t("ahub.signOff")}</div>
          {appLoading ? (
            <div className="ui-empty-msg"><div className="spinner spinner-center" />{t("common.loading")}</div>
          ) : appRows.length === 0 ? (
            <div className="card ui-empty-msg">
              <div className="u-mb-2"><Icon e="✅" size={28} color="var(--success)" /></div>{t("ahub.allCaughtUp")}
            </div>
          ) : (
            appRows.map((r) => (
              <div key={r.id} className="card u-mb-2">
                <div className="d-flex jc-sb ai-c mb-2">
                  <div className="ui-strong">
                    {r.name}
                    {r.overtime && <span className="t-xs tone-warn ml-2"><Icon e="⏱" size={11} /> {t("approvals.overtime")}</span>}
                    {r.late_mins > 0 && <span className="t-xs tone-danger ml-2"><Icon e="⚠" size={11} /> {t("ahub.mLate", { n: r.late_mins })}</span>}
                  </div>
                  <div className="t-sm fw-7 tone-action">{fmtH(r.duration_mins || 0)}</div>
                </div>
                <div className="ui-sub">
                  {fmtDate(r.work_date)} · {r.team ? teamLabel(r.team) : "—"} · {fmtTime(r.clock_in)} → {fmtTime(r.clock_out)}
                </div>
                <div className="u-hstack">
                  <button className="btn-gold" onClick={() => decide(r.id, "approved")} disabled={busyId === r.id}>{busyId === r.id ? "…" : t("ahub.approve")}</button>
                  <button className="btn-quiet-danger" onClick={() => decide(r.id, "rejected")} disabled={busyId === r.id}>{t("ahub.reject")}</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ───────── OVERTIME ───────── */}
      {tab === "overtime" && !readError && (
        <div className="hub-tab-panel active">
          <div className="d-flex gap-2 mb-3 ai-c">
            <input className="form-input u-flex1" aria-label={t("ahub.tabOvertime")} type="month" value={month} onChange={(e) => changeMonth(e.target.value)} />
          </div>

          {otLoading ? (
            <div className="ui-empty-msg"><div className="spinner spinner-center" />{t("common.loading")}</div>
          ) : (
            <>
              {/* summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
                <Stat value={otStats.peopleOver} label={t("home.overContract")} color={otStats.peopleOver > 0 ? "var(--warn)" : "var(--success)"} />
                <Stat value={fmtH(otStats.totalOvertimeMins)} label={t("ahub.totalOvertime")} color={otStats.totalOvertimeMins > 0 ? "var(--warn)" : "var(--white)"} />
              </div>

              {otRows.length === 0 ? (
                <div className="card ui-empty-msg">{t("ahub.noHoursMonth")}</div>
              ) : (
                <div className="card">
                  <div className="card-title">{t("ahub.contractVsWorked")}</div>
                  {otRows.map((r, i) => {
                    const over = r.overtimeMins > 0;
                    const pct = r.contractHours > 0 ? Math.min(100, Math.round((r.workedMins / (r.contractHours * 60)) * 100)) : 0;
                    return (
                      <div key={r.user_id} style={{ padding: "11px 0", borderBottom: i < otRows.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                        <div className="u-between">
                          <div className="ui-strong">{r.name} <span className="ui-muted">· {r.team ? teamLabel(r.team) : "—"}</span></div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: over ? "var(--warn)" : "var(--success)" }}>{over ? `+${fmtH(r.overtimeMins)}` : t("ahub.within")}</div>
                        </div>
                        <div className="ui-meta">
                          {t("ahub.workedContract", { w: fmtH(r.workedMins), c: r.contractHours, s: r.shifts })}{r.contractType ? ` · ${r.contractType}` : ""}
                        </div>
                        {/* progress bar: normal (gold) + overtime (orange) */}
                        <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, marginTop: 7, overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, background: over ? "var(--warn)" : "var(--gold)" }} />
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
                      <span className="u-text">{l.name} <span className="ui-muted">· {fmtDate(l.work_date)}</span></span>
                      <span className="tone-warn fw-6">{fmtH(l.mins)}</span>
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
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#b9770e,#e67e22)" }}><Icon e="🚫" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("ahub.noShowTracking")}</div><div className="feature-sub">{t("ahub.noShowTrackingSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <div className="card t-xs u-muted lh-16">
            {t("ahub.noShowHint")}
          </div>
        </div>
      )}
    </div>
  );
}

const todayBtn: React.CSSProperties = { padding: "10px 16px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
