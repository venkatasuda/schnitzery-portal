"use client";

import { useEffect, useState, useRef } from "react";
import {
  getMyStatus, clockIn, clockOut, getMyHistory, startBreak, endBreak,
} from "@/lib/queries/attendance";
import { clockInWithCode, clockOutWithCode, clockWithQR } from "@/lib/queries/clockcode";
import { isOnline, captureOffline, codeFromQR, type ClockAction } from "@/lib/offline/attendanceQueue";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";
import QrScanner from "./QrScanner";
import SyncStatus from "@/components/SyncStatus";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

export default function AttendancePage() {
  const { t } = useLang();
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
  const [histLoading, setHistLoading] = useState(false);
  const [histTab, setHistTab] = useState<"week" | "month">("week");

  async function refresh() {
    const res = await getMyStatus();
    if (res.ok) {
      setClockedIn(res.clockedIn || false);
      setOnBreak(res.onBreak || false);
      setSession(res.session);
    } else setMessage(res.error || t("att.couldNotLoad"));
    setLoading(false);
  }

  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short", year: "numeric" }));
    refresh();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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

  async function doAction(fn: () => Promise<any>, okMsg: string, offlineAction?: ClockAction) {
    setWorking(true);
    setMessage(null);
    if (offlineAction && !isOnline()) {
      captureOffline(offlineAction);
      applyOptimistic(offlineAction);
      setMessage(t("att.savedOffline"));
      setWorking(false);
      return;
    }
    try {
      const res = await fn();
      setMessage(res.ok ? okMsg : res.error || t("att.failed"));
      await refresh();
    } catch {
      if (offlineAction) { captureOffline(offlineAction); applyOptimistic(offlineAction); setMessage(t("att.savedOffline")); }
      else setMessage(t("att.failed"));
    }
    setWorking(false);
  }

  async function loadHistory(tab: "week" | "month") {
    setHistLoading(true);
    const { from, to } = rangeFor(tab);
    const res = await getMyHistory(from, to);
    if (res.ok) setHistory(res.sessions || []);
    setHistLoading(false);
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
      captureOffline(action, clean); applyOptimistic(action);
      setWorking(false); setShowCode(false); setMessage(t("att.savedOffline"));
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
        await refresh();
      } else {
        setCodeErr(res.error || t("att.failedShort"));
      }
    } catch {
      captureOffline(action, clean); applyOptimistic(action);
      setWorking(false); setShowCode(false); setMessage(t("att.savedOffline"));
    }
  }

  async function handleScan(payload: string) {
    setShowScan(false);
    setWorking(true);
    const action: ClockAction = codeMode === "out" ? "clock_out" : "clock_in";
    if (!isOnline()) {
      captureOffline(action, codeFromQR(payload)); applyOptimistic(action);
      setWorking(false); setMessage(t("att.savedOffline"));
      return;
    }
    setMessage(t("att.readingQR"));
    const g = await getGeo();
    try {
      const res = await clockWithQR(payload, codeMode, g?.lat, g?.lng);
      setWorking(false);
      if (res.ok) {
        setMessage(codeMode === "out" ? t("att.outQR") : t("att.inQR"));
        await refresh();
      } else {
        setMessage(res.error || t("att.qrFailed"));
      }
    } catch {
      captureOffline(action, codeFromQR(payload)); applyOptimistic(action);
      setWorking(false); setMessage(t("att.savedOffline"));
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
    d ? new Date(d).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }) : "—";
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
  if (session?.clock_in) timeline.push({ label: t("att.tlClockIn"), time: fmtTime(session.clock_in), color: "#58d68d" });
  breaks.forEach((b: any, i: number) => {
    timeline.push({ label: t("att.tlBreakStart", { n: i + 1 }), time: fmtTime(b.start), color: "#e8a35a" });
    if (b.end) {
      const mins = Math.max(0, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000));
      timeline.push({ label: t("att.tlBreakEnd", { n: i + 1 }), time: fmtTime(b.end), extra: `${mins} ${t("att.minutesShort")}`, color: "#e8a35a" });
    }
  });
  if (session?.clock_out) timeline.push({ label: t("att.tlClockOut"), time: fmtTime(session.clock_out), color: "#ec7063" });

  const statusLabel = onBreak ? t("att.statusOnBreak") : clockedIn ? t("att.statusWorking") : t("att.statusNotIn");
  const statusColor = onBreak ? "#e8a35a" : clockedIn ? "#58d68d" : "var(--gray)";
  const statusEmoji = onBreak ? "☕" : clockedIn ? "🟢" : "⚪";

  return (
    <div className="fade-up">
      <div className="page-title">🕐 {t("att.title")}</div>
      <SyncStatus />
      <Link href="/attendance/corrections" style={{ display: "block", textAlign: "center", margin: "0 0 14px", padding: "9px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.18)", borderRadius: 10, color: "var(--gold)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>✏️ {t("corr.request")}</Link>
      <div className="page-sub" style={{ minHeight: 16 }}>{todayLabel}</div>

      <div className="card" style={{ padding: 24 }}>
        {loading ? (
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Skeleton height={15} width={130} /></div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Skeleton height={118} width={118} radius={60} /></div>
            <Skeleton height={46} radius={12} />
          </div>
        ) : (
          <>
            {/* STATUS */}
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: statusColor }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor, boxShadow: clockedIn ? `0 0 10px ${statusColor}` : "none" }} />
                {statusEmoji} {statusLabel}
              </span>
              <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 5 }}>
                {clockedIn ? (onBreak ? t("att.subOnBreak") : t("att.subWorking")) : t("att.subReady")}
              </div>
            </div>

            {/* STOPWATCH */}
            <div style={{ textAlign: "center", margin: "20px 0 18px" }}>
              <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--gold)", lineHeight: 1, letterSpacing: 1 }}>
                {tt.h}<span style={{ fontSize: 24, color: "var(--gray)" }}>h </span>
                {String(tt.m).padStart(2, "0")}<span style={{ fontSize: 24, color: "var(--gray)" }}>m </span>
                {String(tt.s).padStart(2, "0")}<span style={{ fontSize: 24, color: "var(--gray)" }}>s</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2.5, color: "var(--gray)", marginTop: 8, textTransform: "uppercase" }}>{t("att.totalTimeToday")}</div>
            </div>

            {/* STATUS ROW: In / Break / Out / Total */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
              <StatCell label={t("att.in")} value={fmtTime(session?.clock_in)} color="#58d68d" />
              <StatCell label={t("att.break")} value={totalBreakMin > 0 ? `${totalBreakMin}m` : "—"} color="#e8a35a" />
              <StatCell label={t("att.out")} value={fmtTime(session?.clock_out)} color="#ec7063" />
              <StatCell label={t("att.total")} value={session?.clock_out ? fmtDur(session.duration_mins) : (clockedIn ? `${tt.h}h ${String(tt.m).padStart(2, "0")}m` : "—")} color="var(--gold)" />
            </div>

            {/* ACTION BUTTONS */}
            {!clockedIn ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={clockInAction} disabled={working} style={bigBtn("linear-gradient(135deg,#1e8449,#27ae60)", working)}>{t("att.clockInNow")}</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setCodeMode("in"); setShowScan(true); }} disabled={working} style={secBtn(working)}>{t("att.scanQR")}</button>
                  <button onClick={() => openCode("in")} disabled={working} style={secBtn(working)}>{t("att.code")}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!onBreak ? (
                  <button onClick={() => doAction(startBreak, t("att.breakStarted"), "break_start")} disabled={working} style={bigBtn("linear-gradient(135deg,#b9770e,#e67e22)", working)}>{t("att.startBreak")}</button>
                ) : (
                  <button onClick={() => doAction(endBreak, t("att.breakEnded"), "break_end")} disabled={working} style={bigBtn("linear-gradient(135deg,#117a65,#16a085)", working)}>{t("att.endBreak")}</button>
                )}
                <button onClick={clockOutAction} disabled={working || onBreak} style={bigBtn("linear-gradient(135deg,#922b21,#c0392b)", working || onBreak)}>{t("att.clockOut")}</button>
                {!onBreak && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setCodeMode("out"); setShowScan(true); }} disabled={working} style={secBtn(working)}>{t("att.scanQR")}</button>
                    <button onClick={() => openCode("out")} disabled={working} style={secBtn(working)}>{t("att.code")}</button>
                  </div>
                )}
                {onBreak && <div style={{ fontSize: 11, color: "var(--gray)", textAlign: "center" }}>{t("att.endBreakFirst")}</div>}
              </div>
            )}

            {message && <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--gold)" }}>{message}</div>}
          </>
        )}
      </div>

      {/* TODAY'S TIMELINE */}
      {timeline.length > 0 && (
        <div className="card">
          <div className="card-title">{t("att.todaysTimeline")}</div>
          {timeline.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(128,128,128,0.12)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: "var(--white)" }}>{e.label}</span>
              {e.extra && <span style={{ fontSize: 12, color: "#e8a35a" }}>{e.extra}</span>}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>{e.time}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13 }}>
            <span style={{ color: "var(--gray)" }}>{t("att.totalBreakTime")}</span>
            <span style={{ color: "#e8a35a", fontWeight: 600 }}>{totalBreakMin} {t("att.minutesShort")}</span>
          </div>
          {session?.clock_out && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
              <span style={{ color: "var(--gray)" }}>{t("att.totalTimeInOut")}</span>
              <span style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtDur(session.duration_mins)}</span>
            </div>
          )}
        </div>
      )}

      {showScan && <QrScanner onScan={handleScan} onClose={() => setShowScan(false)} />}

      {/* CODE ENTRY MODAL */}
      {showCode && (
        <div onClick={() => setShowCode(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 360, width: "100%", padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--white)" }}>
              {codeMode === "out" ? t("att.codeOutTitle") : t("att.codeInTitle")}
            </div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 16 }}>
              {t("att.codeHint")}
            </div>
            <input
              autoFocus
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="000000"
              inputMode="numeric"
              style={{ width: "100%", padding: "14px", fontSize: 28, letterSpacing: 8, textAlign: "center", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", boxSizing: "border-box" }}
            />
            {codeErr && <div style={{ color: "#ec7063", fontSize: 12, marginTop: 10, textAlign: "center" }}>{codeErr}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCode(false)} style={{ ...secBtn(false), flex: 1 }}>{t("common.cancel")}</button>
              <button onClick={submitCode} disabled={working} style={{ ...bigBtn("linear-gradient(135deg,#1e8449,#27ae60)", working), flex: 1 }}>{working ? "…" : t("att.confirm")}</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={toggleHistory} style={historyToggle}>📅  {showHistory ? t("att.hideHistory") : t("att.viewHistory")}</button>

      {showHistory && (
        <div style={{ marginTop: 14 }}>
          {/* week / month tabs */}
          <div className="hub-tabs">
            <button className={`hub-tab${histTab === "week" ? " active" : ""}`} onClick={() => switchHistTab("week")}>📅 {t("att.weekLabel")}</button>
            <button className={`hub-tab${histTab === "month" ? " active" : ""}`} onClick={() => switchHistTab("month")}>🗓 {t("att.monthLabel")}</button>
          </div>

          {/* days worked + hours stats */}
          <div className="card" style={{ display: "flex", padding: "16px 0", marginBottom: 12 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--gold)", lineHeight: 1 }}>{histDaysWorked}</div>
              <div style={{ fontSize: 10, color: "var(--gray)", marginTop: 5, letterSpacing: 1, textTransform: "uppercase" }}>{t("att.daysWorked")}</div>
            </div>
            <div style={{ width: 1, background: "rgba(128,128,128,0.15)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--gold)", lineHeight: 1 }}>{histHours}</div>
              <div style={{ fontSize: 10, color: "var(--gray)", marginTop: 5, letterSpacing: 1, textTransform: "uppercase" }}>{histTab === "week" ? t("att.weekLabel") : t("att.monthLabel")}</div>
            </div>
          </div>

          {/* records */}
          {histLoading ? (
            <CardSkeleton rows={3} />
          ) : history.length === 0 ? (
            <div className="card" style={{ color: "var(--gray)", fontSize: 13, padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>📭</div>
              {histTab === "week" ? t("att.noRecordsWeek") : t("att.noRecordsMonth")}
            </div>
          ) : (
            history.map((s) => {
              const bmin = Math.round(computeBreakMs(s.breaks) / 60000);
              return (
                <div key={s.id} className="card" style={{ padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)", display: "flex", alignItems: "center", gap: 6 }}>{fmtDate(s.work_date)}{s.source === "offline" && <span style={{ fontSize: 9, fontWeight: 700, color: "#e8a35a", background: "rgba(232,163,90,0.15)", padding: "2px 6px", borderRadius: 10 }}>{t("sync.offlineTag")}</span>}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>
                      {s.status === "active" || s.status === "on-break" ? t("att.inProgress") : fmtDur(s.duration_mins)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4 }}>
                    {t("att.recordIn")} {fmtTime(s.clock_in)} → {t("att.recordOut")} {fmtTime(s.clock_out)}{bmin > 0 && ` · ☕ ${bmin} ${t("att.minBreak")}`}
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
    <div style={{ background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.12)", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 4, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
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
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function rangeFor(tab: "week" | "month"): { from: string; to: string } {
  const now = new Date();
  if (tab === "week") {
    const dow = now.getDay(); // 0 Sun .. 6 Sat
    const back = dow === 0 ? 6 : dow - 1; // days since Monday
    const mon = new Date(now); mon.setDate(now.getDate() - back);
    return { from: isoDate(mon), to: isoDate(now) };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(first), to: isoDate(now) };
}

// styles (CSS-variable based so light mode works)
const historyToggle: React.CSSProperties = { width: "100%", marginTop: 14, padding: "13px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.18)", borderRadius: 12, color: "var(--white)", fontSize: 14, cursor: "pointer" };

function bigBtn(bg: string, disabled: boolean): React.CSSProperties {
  return { width: "100%", padding: "16px", background: disabled ? "var(--dark3)" : bg, color: disabled ? "var(--gray)" : "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", transition: "transform 0.1s" };
}
function secBtn(disabled: boolean): React.CSSProperties {
  return { flex: 1, padding: "13px", background: "var(--dark3)", color: disabled ? "var(--gray)" : "var(--white)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer" };
}