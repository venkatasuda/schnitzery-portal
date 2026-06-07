"use client";

import { useEffect, useState } from "react";
import {
  getMyShifts, getWeekStart, getStaffForSwap, submitSwap, getMySwaps,
} from "@/lib/queries/schedule";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TEAM_COLORS: Record<string, string> = {
  Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60",
};

export default function SchedulePage() {
  const [tab, setTab] = useState<"my" | "request" | "mine">("my");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayName, setTodayName] = useState("");

  // swap form
  const [staff, setStaff] = useState<any[]>([]);
  const [myDay, setMyDay] = useState("");
  const [otherId, setOtherId] = useState("");
  const [otherDay, setOtherDay] = useState("");
  const [swapMsg, setSwapMsg] = useState<string | null>(null);
  const [mySwaps, setMySwaps] = useState<any[]>([]);

  async function loadShifts(offset: number) {
    setLoading(true);
    const ws = await getWeekStart(offset);
    const res = await getMyShifts(ws);
    if (res.ok) { setShifts(res.shifts || []); setWeekStart(res.weekStart || ""); }
    setLoading(false);
  }

  useEffect(() => {
    const d = new Date();
    setTodayName(DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]);
    loadShifts(0);
    getStaffForSwap().then((r) => r.ok && setStaff(r.staff || []));
  }, []);

  function changeWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    loadShifts(next);
  }

  async function loadSwaps() {
    const r = await getMySwaps();
    if (r.ok) setMySwaps(r.swaps || []);
  }

  async function doSubmitSwap() {
    setSwapMsg(null);
    const r = await submitSwap(myDay, otherId, otherDay);
    if (r.ok) { setSwapMsg("✅ Swap request submitted!"); setMyDay(""); setOtherId(""); setOtherDay(""); }
    else setSwapMsg(r.error || "Failed.");
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  return (
    <div className="fade-up">
      <div className="page-title">📅 Shifts</div>
      <div className="page-sub">{weekLabel || "Loading…"}</div>

      {/* TABS */}
      <div className="hub-tabs">
        <button className={`hub-tab${tab === "my" ? " active" : ""}`} onClick={() => setTab("my")}>My Shifts</button>
        <button className={`hub-tab${tab === "request" ? " active" : ""}`} onClick={() => setTab("request")}>Request Swap</button>
        <button className={`hub-tab${tab === "mine" ? " active" : ""}`} onClick={() => { setTab("mine"); loadSwaps(); }}>My Requests</button>
      </div>

      {/* MY SHIFTS */}
      {tab === "my" && (
        <div className="hub-tab-panel active">
          {/* week nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => changeWeek(-1)} style={navBtn}>‹ Prev</button>
            <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{weekOffset === 0 ? "This week" : weekOffset > 0 ? `+${weekOffset} week(s)` : `${weekOffset} week(s)`}</span>
            <button onClick={() => changeWeek(1)} style={navBtn}>Next ›</button>
          </div>

          {/* week strip */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-title">This Week</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
              {DAYS.map((d) => {
                const has = shifts.some((s) => s.day === d);
                const isToday = d === todayName && weekOffset === 0;
                return (
                  <div key={d} style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8, background: isToday ? "rgba(212,168,71,0.15)" : "transparent" }}>
                    <div style={{ fontSize: 12, color: isToday ? "var(--gold)" : "var(--gray)", fontWeight: isToday ? 700 : 400 }}>{d[0]}</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", margin: "6px auto 0", background: has ? "#27ae60" : "rgba(128,128,128,0.25)" }} />
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8, textAlign: "center" }}>
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} assigned
            </div>
          </div>

          {/* shifts list */}
          {loading ? (
            <div style={{ color: "var(--gray)", fontSize: 13, padding: 20, textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…
            </div>
          ) : shifts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🗓</div>No shifts assigned this week.
            </div>
          ) : (
            <div className="card">
              <div className="card-title">Your Shifts</div>
              {shifts.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < shifts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEAM_COLORS[s.team] || "#888", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{s.day}</div>
                    <div style={{ fontSize: 12, color: "var(--gray)" }}>{s.team} · {s.shift}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{s.time || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUEST SWAP */}
      {tab === "request" && (
        <div className="hub-tab-panel active">
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--white)" }}>Request a Shift Swap</div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 16 }}>Both you and your colleague will be notified of the result.</div>
            <Field label="Your day to give away">
              <select value={myDay} onChange={(e) => setMyDay(e.target.value)} style={select}>
                <option value="">Select day…</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Swap with">
              <select value={otherId} onChange={(e) => setOtherId(e.target.value)} style={select}>
                <option value="">Select colleague…</option>
                {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
            <Field label="Their day you want">
              <select value={otherDay} onChange={(e) => setOtherDay(e.target.value)} style={select}>
                <option value="">Select day…</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <button onClick={doSubmitSwap} style={primaryBtn}>Submit Swap Request</button>
            {swapMsg && <div style={{ marginTop: 12, fontSize: 13, color: "var(--gold)", textAlign: "center" }}>{swapMsg}</div>}
          </div>
        </div>
      )}

      {/* MY REQUESTS */}
      {tab === "mine" && (
        <div className="hub-tab-panel active">
          {mySwaps.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>No swap requests yet.</div>
          ) : (
            mySwaps.map((sw) => (
              <div key={sw.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--white)" }}>Give <b>{sw.my_day}</b> → get <b>{sw.their_day}</b></div>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: sw.status === "approved" ? "rgba(39,174,96,0.15)" : sw.status === "denied" ? "rgba(231,76,60,0.15)" : "rgba(212,168,71,0.15)", color: sw.status === "approved" ? "#58d68d" : sw.status === "denied" ? "#ec7063" : "var(--gold)" }}>
                    {sw.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--white)", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const select: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };