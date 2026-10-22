"use client";

import { berlinToday, mondayOfDate, monthRange } from "@/lib/time/berlinDate";

import { useEffect, useState, useRef } from "react";
import {
  getMyStatus, clockIn, clockOut, getMyHistory, startBreak, endBreak,
} from "@/lib/queries/attendance";
import { clockInWithCode, clockOutWithCode, clockWithQR } from "@/lib/queries/clockcode";
import { isOnline, captureOffline, codeFromQR, readQueueMine, getQueueOwner, type ClockAction } from "@/lib/offline/attendanceQueue";
import NativeDialog from "@/components/NativeDialog";
import OfflineReview from "@/components/OfflineReview";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";
import QrScanner from "./QrScanner";
import SyncStatus from "@/components/SyncStatus";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

export default function AttendancePage() {
  const { t, locale } = useLang();
  const dateLocale = locale === "de" ? "de-DE" : "en-US";
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  // code entry
  const [showCode, setShowCode] = useState(false);
  const [codeMode, setCodeMode] = useState<"in" | "out">("in");
  const [codeValue, setCodeValue] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);

  // qr scanner
  const [showScan, setShowScan] = useState(false);

  const [elapsed, setElapsed] = useState(0); // total seconds since clock-in (counts everything)
  const [todayLabel, setTodayLabel] = useState(""); // set client-side to avoid hydration mismatch
  const timerRef = useRef<any>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [statusError,setStatusError]=useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [historyError,setHistoryError]=useState(false);
  const historyRequest=useRef(0);
  const [histTab, setHistTab] = useState<"week" | "month">("week");

  async function refresh() {
    try {
      const res = await getMyStatus();
      if (!res.ok)throw Error();
      setClockedIn(res.clockedIn || false);
      setOnBreak(res.onBreak || false);
      setSession(res.session);
      setStatusError(false);
    } catch {setStatusError(true);setMessage(t("att.couldNotLoad"));}
    finally {setLoading(false);}
  }

  useEffect(() => {
    refresh();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Follow the app's EN/DE choice, not the browser's language.
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "2-digit", month: "short", year: "numeric" }));
  }, [dateLocale]);

  // Once queued offline records have synced, drop the "saved offline" note and
  // reload the server's status so the screen shows what was actually recorded.
  const messageRef = useRef(message);
  messageRef.current = message;
  useEffect(() => {
    const onQueue = () => {
      if (messageRef.current !== t("att.savedOffline") || readQueueMine(getQueueOwner()).length) return;
      setMessage(null);
      refresh();
    };
    window.addEventListener("sz-queue-changed", onQueue);
    return () => window.removeEventListener("sz-queue-changed", onQueue);
  }, [t]);

  // Live timer: counts TOTAL time since clock-in (break time included).
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (clockedIn && session?.clock_in) {
      const compute = () => {
        const start = new Date(session.clock_in).getTime();
        setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      };
      compute();
      timerRef.current = setInterval(compute, 1000);
    } else setElapsed(0);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [clockedIn, session]);

  // Optimistically reflect an offline-captured action (the real state syncs later).
  function applyOptimistic(action: ClockAction) {
    if (action === "clock_in") { setClockedIn(true); setOnBreak(false); setSession({ clock_in: new Date().toISOString() }); }
    else if (action === "clock_out") { setClockedIn(false); setOnBreak(false); setSession(null); }
    else if (action === "break_start") setOnBreak(true);
    else if (action === "break_end") setOnBreak(false);
  }

  async function saveForSync(action: ClockAction, code?: string) {
    try {
      await captureOffline(action, code);
      applyOptimistic(action);
      setMessage(t("att.savedOffline"));
      return true;
    } catch {
      setMessage(t("att.offlineNotSaved"));
      return false;
    }
  }

  // Best-effort device location. Resolves null if unavailable/denied/slow —
  // the DB decides whether that's acceptable based on the branch's gps_mode.
  function getGeo(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  async function clockInAction() {
    setMessage(t("att.locating"));
    const g = isOnline() ? await getGeo() : null;
    await doAction(() => clockIn(undefined, g?.lat, g?.lng), t("att.clockedIn"), "clock_in");
  }
  async function clockOutAction() {
    setMessage(t("att.locating"));
    const g = isOnline() ? await getGeo() : null;
    await doAction(() => clockOut(undefined, g?.lat, g?.lng), t("att.clockedOut"), "clock_out");
  }
  async function breakStartAction() {
    const g = isOnline() ? await getGeo() : null;
    await doAction(() => startBreak(g?.lat, g?.lng), t("att.breakStarted"), "break_start");
  }
  async function breakEndAction() {
    const g = isOnline() ? await getGeo() : null;
    await doAction(() => endBreak(g?.lat, g?.lng), t("att.breakEnded"), "break_end");
  }

  async function doAction(fn: () => Promise<any>, okMsg: string, offlineAction?: ClockAction) {
    setWorking(true);
    setMessage(null);
    if (offlineAction && !isOnline()) {
      await saveForSync(offlineAction);
      setWorking(false);
      return;
    }
    try {
      const res = await fn();
      setMessage(res.ok ? okMsg : res.error || t("att.failed"));
      await refresh().catch(() => setMessage(t("att.couldNotLoad")));
    } catch {
      if (offlineAction) await saveForSync(offlineAction);
      else setMessage(t("att.failed"));
    }
    setWorking(false);
  }

  async function loadHistory(tab: "week" | "month") {
    const serial=++historyRequest.current;
    setHistLoading(true);
    setHistoryError(false);
    try {
    const { from, to } = rangeFor(tab);
    const res = await getMyHistory(from, to);
    if(serial!==historyRequest.current)return;
    if (!res.ok) throw Error();
    setHistory(res.sessions || []);
    }catch{if(serial===historyRequest.current)setHistoryError(true);}
    finally{if(serial===historyRequest.current)setHistLoading(false);}
  }
  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory(histTab);
  }
  function switchHistTab(tab: "week" | "month") {
    setHistTab(tab);
    loadHistory(tab);
  }

  function openCode(mode: "in" | "out") {
    setCodeMode(mode);
    setCodeValue("");
    setCodeErr(null);
    setShowCode(true);
  }

  async function submitCode() {
    setCodeErr(null);
    const clean = codeValue.replace(/\D/g, "");
    if (clean.length !== 6) { setCodeErr(t("att.enter6")); return; }
    setWorking(true);
    const action: ClockAction = codeMode === "out" ? "clock_out" : "clock_in";
    if (!isOnline()) {
      const saved = await saveForSync(action, clean);
      setWorking(false); if (saved) setShowCode(false); else setCodeErr(t("att.offlineNotSaved"));
      return;
    }
    const fn = codeMode === "out" ? clockOutWithCode : clockInWithCode;
    const g = await getGeo();
    try {
      const res = await fn(clean, g?.lat, g?.lng);
      setWorking(false);
      if (res.ok) {
        setShowCode(false);
        setMessage(codeMode === "out" ? t("att.outCode") : t("att.inCode"));
        await refresh().catch(() => setMessage(t("att.couldNotLoad")));
      } else {
        setCodeErr(res.error || t("att.failedShort"));
      }
    } catch {
      const saved = await saveForSync(action, clean);
      setWorking(false); if (saved) setShowCode(false); else setCodeErr(t("att.offlineNotSaved"));
    }
  }

  async function handleScan(payload: string) {
    setShowScan(false);
    setWorking(true);
    const action: ClockAction = codeMode === "out" ? "clock_out" : "clock_in";
    if (!isOnline()) {
      await saveForSync(action, codeFromQR(payload));
      setWorking(false);
      return;
    }
    setMessage(t("att.readingQR"));
    const g = await getGeo();
    try {
      const res = await clockWithQR(payload, codeMode, g?.lat, g?.lng);
      setWorking(false);
      if (res.ok) {
        setMessage(codeMode === "out" ? t("att.outQR") : t("att.inQR"));
        await refresh().catch(() => setMessage(t("att.couldNotLoad")));
      } else {
        setMessage(res.error || t("att.qrFailed"));
      }
    } catch {
      await saveForSync(action, codeFromQR(payload));
      setWorking(false);
    }
  }

  // formatting
  const hms = (secs: number) => ({
    h: Math.floor(secs / 3600),
    m: Math.floor((secs % 3600) / 60),
    s: secs % 60,
  });
  const tt = hms(elapsed);
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString(dateLocale, { weekday: "short", day: "2-digit", month: "short" }) : "—";
  const fmtDur = (min: number | null) =>
    min == null ? "—" : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

  const breaks = parseBreaks(session?.breaks);
  const totalBreakMin = Math.round(computeBreakMs(session?.breaks) / 60000);

  // history stats (days worked + total hours for the selected week/month)
  const histDaysWorked = new Set(history.filter((s) => s.status === "complete").map((s) => s.work_date)).size;
  const histMins = history.reduce((sum, s) => sum + (s.duration_mins || 0), 0);
  const histHours = `${Math.floor(histMins / 60)}h ${String(histMins % 60).padStart(2, "0")}m`;

  // Build the day's timeline events
  const timeline: { label: string; time: string; extra?: string; color: string }[] = [];
  if (session?.clock_in) timeline.push({ label: t("att.tlClockIn"), time: fmtTime(session.clock_in), color: "var(--success)" });
  breaks.forEach((b: any, i: number) => {
    timeline.push({ label: t("att.tlBreakStart", { n: i + 1 }), time: fmtTime(b.start), color: "var(--warn)" });
    if (b.end) {
      const mins = Math.max(0, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000));
      timeline.push({ label: t("att.tlBreakEnd", { n: i + 1 }), time: fmtTime(b.end), extra: `${mins} ${t("att.minutesShort")}`, color: "var(--warn)" });
    }
  });
  if (session?.clock_out) timeline.push({ label: t("att.tlClockOut"), time: fmtTime(session.clock_out), color: "var(--danger)" });

  const statusLabel = onBreak ? t("att.statusOnBreak") : clockedIn ? t("att.statusWorking") : t("att.statusNotIn");

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🕐" size={22} /> {t("att.title")}</h1>
      <SyncStatus />
      <details><summary>{t("offlineReview.title")}</summary><OfflineReview /></details>
      <Link href="/attendance/corrections" className="clock-link"><Icon e="✏️" size={14} /> {t("corr.request")}</Link>
      <div className="page-sub">{todayLabel}</div>

      <div className="card p-6">
        {statusError ? <div role="alert"><p>{t("att.couldNotLoad")}</p><button className="btn-secondary" onClick={refresh}>{t("business.retry")}</button></div> : loading ? (
          <div>
            <div className="d-flex jc-c mb-4"><Skeleton height={15} width={130} /></div>
            <div className="d-flex jc-c mb-5"><Skeleton height={118} width={118} radius={60} /></div>
            <Skeleton height={46} radius={12} />
          </div>
        ) : (
          <>
            {/* STATUS */}
            <div className="u-center mb-2">
              <span className={`clock-status${onBreak ? " break" : clockedIn ? " working" : ""}`} role="status">
                <span className="clock-dot" aria-hidden="true" />
                {statusLabel}
              </span>
              <div className="t-xs u-muted mt-1">
                {clockedIn ? (onBreak ? t("att.subOnBreak") : t("att.subWorking")) : t("att.subReady")}
              </div>
            </div>

            {/* STOPWATCH */}
            <div className="clock-timer">
              <div className="clock-timer-value">
                {tt.h}<span className="t-2xl u-muted">h </span>
                {String(tt.m).padStart(2, "0")}<span className="t-2xl u-muted">m </span>
                {String(tt.s).padStart(2, "0")}<span className="t-2xl u-muted">s</span>
              </div>
              <div className="clock-caption">{t("att.totalTimeToday")}</div>
            </div>

            {/* STATUS ROW: In / Break / Out / Total */}
            <div className="clock-cells">
              <StatCell label={t("att.in")} value={fmtTime(session?.clock_in)} color="var(--success)" />
              <StatCell label={t("att.break")} value={totalBreakMin > 0 ? `${totalBreakMin}m` : "—"} color="var(--warn)" />
              <StatCell label={t("att.out")} value={fmtTime(session?.clock_out)} color="var(--danger)" />
              <StatCell label={t("att.total")} value={session?.clock_out ? fmtDur(session.duration_mins) : (clockedIn ? `${tt.h}h ${String(tt.m).padStart(2, "0")}m` : "—")} color="var(--gold)" />
            </div>

            {/* ACTION BUTTONS */}
            {!clockedIn ? (
              <div className="u-stack">
                <button onClick={clockInAction} disabled={working} className="clock-btn in">{t("att.clockInNow")}</button>
                <div className="u-hstack">
                  <button onClick={() => { setCodeMode("in"); setShowScan(true); }} disabled={working} className="clock-alt">{t("att.scanQR")}</button>
                  <button onClick={() => openCode("in")} disabled={working} className="clock-alt">{t("att.code")}</button>
                </div>
              </div>
            ) : (
              <div className="u-stack">
                {!onBreak ? (
                  <button onClick={breakStartAction} disabled={working} className="clock-btn break">{t("att.startBreak")}</button>
                ) : (
                  <button onClick={breakEndAction} disabled={working} className="clock-btn resume">{t("att.endBreak")}</button>
                )}
                <button onClick={clockOutAction} disabled={working || onBreak} className="clock-btn out">{t("att.clockOut")}</button>
                {!onBreak && (
                  <div className="u-hstack">
                    <button onClick={() => { setCodeMode("out"); setShowScan(true); }} disabled={working} className="clock-alt">{t("att.scanQR")}</button>
                    <button onClick={() => openCode("out")} disabled={working} className="clock-alt">{t("att.code")}</button>
                  </div>
                )}
                {onBreak && <div className="t-xs u-muted u-center">{t("att.endBreakFirst")}</div>}
              </div>
            )}

            {message && <div className="u-center mt-4 t-sm tone-action">{message}</div>}
          </>
        )}
      </div>

      {/* TODAY'S TIMELINE */}
      {timeline.length > 0 && (
        <div className="card">
          <div className="card-title">{t("att.todaysTimeline")}</div>
          {timeline.map((e, i) => (
            <div key={i} className="clock-row">
              <span className="clock-dot" style={{ color: e.color }} aria-hidden="true" />
              <span className="u-flex1 t-md u-text">{e.label}</span>
              {e.extra && <span className="t-xs tone-warn">{e.extra}</span>}
              <span className="t-md fw-6 tone-action">{e.time}</span>
            </div>
          ))}
          <div className="d-flex jc-sb mt-3 t-sm">
            <span className="u-muted">{t("att.totalBreakTime")}</span>
            <span className="tone-warn fw-6">{totalBreakMin} {t("att.minutesShort")}</span>
          </div>
          {session?.clock_out && (
            <div className="d-flex jc-sb mt-2 t-sm">
              <span className="u-muted">{t("att.totalTimeInOut")}</span>
              <span className="tone-action fw-7">{fmtDur(session.duration_mins)}</span>
            </div>
          )}
        </div>
      )}

      {showScan && <QrScanner onScan={handleScan} onClose={() => setShowScan(false)} />}

      {/* CODE ENTRY MODAL */}
      {showCode && (
        <NativeDialog title={codeMode === "out" ? t("att.codeOutTitle") : t("att.codeInTitle")} busy={working} onClose={() => setShowCode(false)}>
            <div className="t-xl fw-7 mb-1 u-text">
              {codeMode === "out" ? t("att.codeOutTitle") : t("att.codeInTitle")}
            </div>
            <div className="t-xs u-muted mb-4">
              {t("att.codeHint")}
            </div>
            <input
              autoFocus
              aria-label={t("att.codeHint")}
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="000000"
              inputMode="numeric"
              className="clock-code"
            />
            {codeErr && <div className="tone-danger t-xs mt-3 u-center">{codeErr}</div>}
            <div className="d-flex gap-2 mt-4">
              <button disabled={working} onClick={() => setShowCode(false)} className="clock-alt">{t("common.cancel")}</button>
              <button onClick={submitCode} disabled={working} className="clock-btn in u-flex1">{working ? "…" : t("att.confirm")}</button>
            </div>
        </NativeDialog>
      )}

      <button onClick={toggleHistory} className="clock-toggle" aria-expanded={showHistory}><Icon e="📅" size={15} /> {showHistory ? t("att.hideHistory") : t("att.viewHistory")}</button>

      {showHistory && (
        <div className="mt-4">
          {/* week / month tabs */}
          <div className="hub-tabs">
            <button className={`hub-tab${histTab === "week" ? " active" : ""}`} onClick={() => switchHistTab("week")}><Icon className="u-icon-inline" e="📅" size={13} /> {t("att.weekLabel")}</button>
            <button className={`hub-tab${histTab === "month" ? " active" : ""}`} onClick={() => switchHistTab("month")}><Icon className="u-icon-inline" e="🗓" size={13} /> {t("att.monthLabel")}</button>
          </div>

          {/* days worked + hours stats */}
          <div className="card clock-summary">
            <div><strong>{histDaysWorked}</strong><span className="clock-caption">{t("att.daysWorked")}</span></div>
            <div><strong>{histHours}</strong><span className="clock-caption">{histTab === "week" ? t("att.weekLabel") : t("att.monthLabel")}</span></div>
          </div>

          {/* records */}
          {histLoading ? (
            <CardSkeleton rows={3} />
          ) : historyError ? <p role="alert">{t("offlineReview.failed")} <button className="btn-secondary" onClick={()=>loadHistory(histTab)}>{t("business.retry")}</button></p> : history.length === 0 ? (
            <div className="card ui-empty-msg">
              <div className="u-mb-2"><Icon e="📭" size={28} color="var(--gray)" /></div>
              {histTab === "week" ? t("att.noRecordsWeek") : t("att.noRecordsMonth")}
            </div>
          ) : (
            history.map((s) => {
              const bmin = Math.round(computeBreakMs(s.breaks) / 60000);
              return (
                <div key={s.id} className="card p-4 mb-2">
                  <div className="u-between">
                    <div className="t-md fw-6 u-text d-flex ai-c gap-2">{fmtDate(s.work_date)}{s.source === "offline" && <span className="ui-tag-warn">{t("sync.offlineTag")}</span>}</div>
                    <div className="t-md fw-7 tone-action">
                      {s.status === "active" || s.status === "on-break" ? t("att.inProgress") : fmtDur(s.duration_mins)}
                    </div>
                  </div>
                  <div className="t-xs u-muted mt-1">
                    {t("att.recordIn")} {fmtTime(s.clock_in)} → {t("att.recordOut")} {fmtTime(s.clock_out)}{bmin > 0 && <span className="d-iflex ai-c gap-1"> · <Icon e="☕" size={11} /> {bmin} {t("att.minBreak")}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// at-a-glance status cell
function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="clock-cell">
      <strong style={{ color }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// break math
function parseBreaks(raw: any): Array<{ start: string; end: string | null }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}
function computeBreakMs(raw: any): number {
  let ms = 0;
  for (const b of parseBreaks(raw)) {
    if (b.start && b.end) ms += Math.max(0, new Date(b.end).getTime() - new Date(b.start).getTime());
  }
  return ms;
}

// date ranges for the history tabs (Monday-start week, calendar month)
function rangeFor(tab: "week" | "month"): { from: string; to: string } {
  const to = berlinToday();
  return { from: tab === "week" ? mondayOfDate(to) : monthRange(to.slice(0, 7)).from, to };
}
