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
    if (res.ok) { setShifts(res.shifts); setWeekStart(res.weekStart); }
    setLoading(false);
  }

  useEffect(() => {
    const d = new Date();
    setTodayName(DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]);
    loadShifts(0);
    getStaffForSwap().then((r) => r.ok && setStaff(r.staff));
  }, []);

  function changeWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    loadShifts(next);
  }

  async function loadSwaps() {
    const r = await getMySwaps();
    if (r.ok) setMySwaps(r.swaps);
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
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📅 Shifts</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>{weekLabel || "Loading…"}</p>

      {/* TABS */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
        <TabBtn active={tab === "my"} onClick={() => setTab("my")}>My Shifts</TabBtn>
        <TabBtn active={tab === "request"} onClick={() => setTab("request")}>Request Swap</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => { setTab("mine"); loadSwaps(); }}>My Requests</TabBtn>
      </div>

      {/* MY SHIFTS */}
      {tab === "my" && (
        <>
          {/* week nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => changeWeek(-1)} style={navBtn}>‹ Prev</button>
            <span style={{ fontSize: 13, color: "#d4a847" }}>{weekOffset === 0 ? "This week" : weekOffset > 0 ? `+${weekOffset} week(s)` : `${weekOffset} week(s)`}</span>
            <button onClick={() => changeWeek(1)} style={navBtn}>Next ›</button>
          </div>

          {/* week strip */}
          <div style={{ ...card, marginBottom: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "#9a8f8f", marginBottom: 10 }}>THIS WEEK</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
              {DAYS.map((d) => {
                const has = shifts.some((s) => s.day === d);
                const isToday = d === todayName && weekOffset === 0;
                return (
                  <div key={d} style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8, background: isToday ? "rgba(212,168,71,0.15)" : "transparent" }}>
                    <div style={{ fontSize: 12, color: isToday ? "#d4a847" : "#9a8f8f", fontWeight: isToday ? 700 : 400 }}>{d[0]}</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", margin: "6px auto 0", background: has ? "#27ae60" : "rgba(255,255,255,0.12)" }} />
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#9a8f8f", marginTop: 8, textAlign: "center" }}>
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} assigned
            </div>
          </div>

          {/* shifts list */}
          {loading ? (
            <div style={{ color: "#9a8f8f", fontSize: 13, padding: 20, textAlign: "center" }}>Loading…</div>
          ) : shifts.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>
              🗓<br />No shifts assigned this week.
            </div>
          ) : (
            <div style={card}>
              <div style={{ fontSize: 11, letterSpacing: 1, color: "#9a8f8f", marginBottom: 12 }}>YOUR SHIFTS</div>
              {shifts.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < shifts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEAM_COLORS[s.team] || "#888", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.day}</div>
                    <div style={{ fontSize: 12, color: "#9a8f8f" }}>{s.team} · {s.shift}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#d4a847", fontWeight: 600 }}>{s.time || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* REQUEST SWAP */}
      {tab === "request" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Request a Shift Swap</div>
          <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 16 }}>Both you and your colleague will be notified of the result.</div>
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
          {swapMsg && <div style={{ marginTop: 12, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{swapMsg}</div>}
        </div>
      )}

      {/* MY REQUESTS */}
      {tab === "mine" && (
        <div>
          {mySwaps.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No swap requests yet.</div>
          ) : (
            mySwaps.map((sw) => (
              <div key={sw.id} style={{ ...card, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14 }}>Give <b>{sw.my_day}</b> → get <b>{sw.their_day}</b></div>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: sw.status === "approved" ? "rgba(39,174,96,0.15)" : sw.status === "denied" ? "rgba(231,76,60,0.15)" : "rgba(212,168,71,0.15)", color: sw.status === "approved" ? "#58d68d" : sw.status === "denied" ? "#ec7063" : "#d4a847" }}>
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

function TabBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}
function Field({ label, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 };
const navBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };
const select: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };