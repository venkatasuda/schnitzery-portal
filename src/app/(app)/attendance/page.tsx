"use client";

import { useEffect, useState, useRef } from "react";
import {
  getMyStatus, clockIn, clockOut, getMyHistory, startBreak, endBreak,
} from "@/lib/queries/attendance";
import { clockInWithCode, clockOutWithCode, clockWithQR } from "@/lib/queries/clockcode";
import QrScanner from "./QrScanner";

export default function AttendancePage() {
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function refresh() {
    const res = await getMyStatus();
    if (res.ok) {
      setClockedIn(res.clockedIn || false);
      setOnBreak(res.onBreak || false);
      setSession(res.session);
    } else setMessage(res.error || "Could not load status.");
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

  async function doAction(fn: () => Promise<any>, okMsg: string) {
    setWorking(true);
    setMessage(null);
    const res = await fn();
    setMessage(res.ok ? okMsg : res.error || "Failed.");
    await refresh();
    setWorking(false);
  }

  async function loadHistory() {
    setHistLoading(true);
    const res = await getMyHistory(from || undefined, to || undefined);
    if (res.ok) setHistory(res.sessions);
    setHistLoading(false);
  }
  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) loadHistory();
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
    if (clean.length !== 6) { setCodeErr("Enter the 6-digit code"); return; }
    setWorking(true);
    const fn = codeMode === "out" ? clockOutWithCode : clockInWithCode;
    const res = await fn(clean);
    setWorking(false);
    if (res.ok) {
      setShowCode(false);
      setMessage(codeMode === "out" ? "✅ Clocked out with code!" : "✅ Clocked in with code!");
      await refresh();
    } else {
      setCodeErr(res.error || "Failed");
    }
  }

  async function handleScan(payload: string) {
    setShowScan(false);
    setWorking(true);
    setMessage("Reading QR…");
    const res = await clockWithQR(payload, codeMode);
    setWorking(false);
    if (res.ok) {
      setMessage(codeMode === "out" ? "✅ Clocked out by QR!" : "✅ Clocked in by QR!");
      await refresh();
    } else {
      setMessage(res.error || "QR scan failed.");
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

  // Build the day's timeline events
  const timeline: { label: string; time: string; extra?: string; color: string }[] = [];
  if (session?.clock_in) timeline.push({ label: "Clock In", time: fmtTime(session.clock_in), color: "#58d68d" });
  breaks.forEach((b: any, i: number) => {
    timeline.push({ label: `Break ${i + 1} start`, time: fmtTime(b.start), color: "#e8a35a" });
    if (b.end) {
      const mins = Math.max(0, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000));
      timeline.push({ label: `Break ${i + 1} end`, time: fmtTime(b.end), extra: `${mins} min`, color: "#e8a35a" });
    }
  });
  if (session?.clock_out) timeline.push({ label: "Clock Out", time: fmtTime(session.clock_out), color: "#ec7063" });

  const statusLabel = onBreak ? "☕ ON BREAK" : clockedIn ? "🟢 WORKING" : "⚪ NOT CLOCKED IN";
  const statusColor = onBreak ? "#e8a35a" : clockedIn ? "#58d68d" : "#bbb";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 2px", fontFamily: "Georgia, serif" }}>🕐 Clock In / Out</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 18, minHeight: 16 }}>
        {todayLabel}
      </p>

      <div style={card}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#9a8f8f", padding: 30 }}>Loading…</div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: statusColor }}>{statusLabel}</span>
              <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 4 }}>
                {clockedIn ? (onBreak ? "On a break (timer still running)" : "Currently working") : "Ready to start your shift"}
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "18px 0 8px" }}>
              <div style={{ fontSize: 46, fontWeight: 700, fontFamily: "Georgia, serif", color: "#d4a847", lineHeight: 1 }}>
                {tt.h}h {String(tt.m).padStart(2, "0")}m {String(tt.s).padStart(2, "0")}s
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#9a8f8f", marginTop: 6 }}>TOTAL TIME TODAY</div>
            </div>

            {/* ACTION BUTTONS */}
            {!clockedIn ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => doAction(clockIn, "✅ Clocked in!")} disabled={working} style={bigBtn("#27ae60", working)}>▶  Clock In Now</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setCodeMode("in"); setShowScan(true); }} disabled={working} style={{ ...bigBtn("#34495e", working), fontSize: 14 }}>📷  Scan QR</button>
                  <button onClick={() => openCode("in")} disabled={working} style={{ ...bigBtn("#2c3e50", working), fontSize: 14 }}>📲  Code</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!onBreak ? (
                  <button onClick={() => doAction(startBreak, "☕ Break started")} disabled={working} style={bigBtn("#e67e22", working)}>☕  Start Break</button>
                ) : (
                  <button onClick={() => doAction(endBreak, "✅ Break ended")} disabled={working} style={bigBtn("#16a085", working)}>✅  End Break</button>
                )}
                <button onClick={() => doAction(clockOut, "✅ Clocked out!")} disabled={working || onBreak} style={bigBtn("#c0392b", working || onBreak)}>⏹  Clock Out</button>
                {!onBreak && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setCodeMode("out"); setShowScan(true); }} disabled={working} style={{ ...bigBtn("#34495e", working), fontSize: 14 }}>📷  Scan QR</button>
                    <button onClick={() => openCode("out")} disabled={working} style={{ ...bigBtn("#2c3e50", working), fontSize: 14 }}>📲  Code</button>
                  </div>
                )}
                {onBreak && <div style={{ fontSize: 11, color: "#9a8f8f", textAlign: "center" }}>End your break before clocking out.</div>}
              </div>
            )}

            {message && <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#d4a847" }}>{message}</div>}

            {/* TODAY'S TIMELINE */}
            {timeline.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: "#9a8f8f", marginBottom: 10 }}>TODAY&apos;S TIMELINE</div>
                {timeline.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: "#fff" }}>{e.label}</span>
                    {e.extra && <span style={{ fontSize: 12, color: "#e8a35a" }}>{e.extra}</span>}
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#d4a847" }}>{e.time}</span>
                  </div>
                ))}
                {/* summary */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13 }}>
                  <span style={{ color: "#9a8f8f" }}>Total break time</span>
                  <span style={{ color: "#e8a35a", fontWeight: 600 }}>{totalBreakMin} min</span>
                </div>
                {session?.clock_out && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
                    <span style={{ color: "#9a8f8f" }}>Total time (clock-in to out)</span>
                    <span style={{ color: "#d4a847", fontWeight: 700 }}>{fmtDur(session.duration_mins)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showScan && <QrScanner onScan={handleScan} onClose={() => setShowScan(false)} />}

      {/* CODE ENTRY MODAL */}
      {showCode && (
        <div onClick={() => setShowCode(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {codeMode === "out" ? "Clock Out with Code" : "Clock In with Code"}
            </div>
            <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 16 }}>
              Enter the 6-digit code shown on the restaurant display.
            </div>
            <input
              autoFocus
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="000000"
              inputMode="numeric"
              style={{ width: "100%", padding: "14px", fontSize: 28, letterSpacing: 8, textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", boxSizing: "border-box" }}
            />
            {codeErr && <div style={{ color: "#ec7063", fontSize: 12, marginTop: 10, textAlign: "center" }}>{codeErr}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCode(false)} style={{ ...bigBtn("transparent", false), border: "1px solid rgba(255,255,255,0.15)", fontSize: 14 }}>Cancel</button>
              <button onClick={submitCode} disabled={working} style={{ ...bigBtn("#27ae60", working), fontSize: 14 }}>{working ? "…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={toggleHistory} style={historyToggle}>📅  {showHistory ? "Hide" : "View"} My Attendance History</button>

      {showHistory && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
            <div><label style={lbl}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} /></div>
            <div><label style={lbl}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} /></div>
            <button onClick={loadHistory} style={filterBtn}>Filter</button>
            {(from || to) && <button onClick={() => { setFrom(""); setTo(""); setTimeout(loadHistory, 0); }} style={{ ...filterBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>Clear</button>}
          </div>
          {histLoading ? <div style={{ color: "#9a8f8f", fontSize: 13 }}>Loading…</div>
          : history.length === 0 ? <div style={{ color: "#9a8f8f", fontSize: 13, padding: 20, textAlign: "center" }}>No records.</div>
          : history.map((s) => {
              const bmin = Math.round(computeBreakMs(s.breaks) / 60000);
              return (
                <div key={s.id} style={{ ...card, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(s.work_date)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#d4a847" }}>
                      {s.status === "active" || s.status === "on-break" ? "in progress" : fmtDur(s.duration_mins)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 4 }}>
                    In {fmtTime(s.clock_in)} → Out {fmtTime(s.clock_out)}{bmin > 0 && ` · ☕ ${bmin} min break`}
                  </div>
                </div>
              );
            })}
        </div>
      )}
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

// styles
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#9a8f8f", marginBottom: 4 };
const dateInput: React.CSSProperties = { padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13 };
const filterBtn: React.CSSProperties = { padding: "9px 16px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const historyToggle: React.CSSProperties = { width: "100%", marginTop: 14, padding: "13px", background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", fontSize: 14, cursor: "pointer" };
function bigBtn(color: string, disabled: boolean): React.CSSProperties {
  return { width: "100%", padding: "16px", background: disabled ? "#555" : color, color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer" };
}