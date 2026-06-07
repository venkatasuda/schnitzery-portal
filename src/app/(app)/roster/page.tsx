"use client";

import { useEffect, useState } from "react";
import { getRoster, saveRoster, getWeekStart } from "@/lib/queries/schedule";
import { SHIFT_MODEL } from "@/lib/queries/schedule-constants";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TEAMS = Object.keys(SHIFT_MODEL); // Manager, Preparation, Kitchen
const TEAM_COLORS: Record<string, string> = { Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60" };

type Entry = { user_id: string; name: string; team: string; shift: string };
type Roster = Record<string, Entry[]>;

export default function RosterPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [roster, setRoster] = useState<Roster>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  // add-shift form (per selected day)
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [selStaff, setSelStaff] = useState("");
  const [selTeam, setSelTeam] = useState(TEAMS[0]);
  const [selShift, setSelShift] = useState(SHIFT_MODEL[TEAMS[0]][0].shift);

  async function load(offset: number) {
    setLoading(true);
    setMsg(null);
    const ws = await getWeekStart(offset);
    const res = await getRoster(ws);
    if (!res.ok) {
      if (res.error?.includes("managers")) setDenied(true);
      setLoading(false);
      return;
    }
    setWeekStart(res.weekStart || "");
    setRoster(res.roster || {});
    setStaff(res.staff || []);
    setLoading(false);
  }

  useEffect(() => { load(0); }, []);

  function changeWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    load(next);
  }

  function addEntry() {
    if (!activeDay || !selStaff) { setMsg("Pick a staff member."); return; }
    const person = staff.find((p) => p.id === selStaff);
    if (!person) return;
    const entry: Entry = { user_id: person.id, name: person.full_name, team: selTeam, shift: selShift };
    setRoster((r) => {
      const day = r[activeDay] ? [...r[activeDay]] : [];
      // prevent exact duplicate
      if (day.some((e) => e.user_id === entry.user_id && e.team === entry.team && e.shift === entry.shift)) return r;
      day.push(entry);
      return { ...r, [activeDay]: day };
    });
    setSelStaff("");
  }

  function removeEntry(day: string, idx: number) {
    setRoster((r) => {
      const arr = [...(r[day] || [])];
      arr.splice(idx, 1);
      return { ...r, [day]: arr };
    });
  }

  async function doSave() {
    setSaving(true);
    setMsg(null);
    const res = await saveRoster(weekStart, roster);
    setSaving(false);
    setMsg(res.ok ? "✅ Roster saved!" : res.error || "Save failed.");
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  const totalAssigned = DAYS.reduce((sum, d) => sum + (roster[d]?.length || 0), 0);

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>Only managers can edit the roster.</div>;
  }

  return (
    <div className="fade-up">
      <div className="page-title">📋 Weekly Roster</div>
      <div className="page-sub">Assign staff to shifts · {weekLabel || "…"}</div>

      {/* week nav + save */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => changeWeek(-1)} style={navBtn}>‹ Prev</button>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, color: "var(--gold)", fontWeight: 600, padding: "0 4px" }}>
            {weekOffset === 0 ? "This week" : weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}
          </span>
          <button onClick={() => changeWeek(1)} style={navBtn}>Next ›</button>
        </div>
        <button onClick={doSave} disabled={saving} style={{ ...primaryBtn, width: "auto", padding: "10px 24px", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "💾 Save Roster"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "var(--gold)", textAlign: "center" }}>{msg}</div>}

      {loading ? (
        <div style={{ color: "var(--gray)", padding: 30, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…
        </div>
      ) : (
        <>
          {/* WEEK OVERVIEW STRIP (at-a-glance counts per day) */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Week at a Glance · {totalAssigned} shift{totalAssigned !== 1 ? "s" : ""}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
              {DAYS.map((d) => {
                const count = roster[d]?.length || 0;
                const isActive = activeDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(isActive ? null : d)}
                    style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8, border: "none", cursor: "pointer", background: isActive ? "rgba(212,168,71,0.18)" : count > 0 ? "var(--dark3)" : "transparent" }}
                  >
                    <div style={{ fontSize: 12, color: isActive ? "var(--gold)" : "var(--gray)", fontWeight: isActive ? 700 : 500 }}>{d[0]}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: count > 0 ? "var(--white)" : "rgba(128,128,128,0.4)" }}>{count}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DAY CARDS */}
          {DAYS.map((day) => {
            const entries = roster[day] || [];
            const isActive = activeDay === day;
            return (
              <div key={day} className="card" style={{ marginBottom: 10, borderColor: isActive ? "rgba(212,168,71,0.3)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entries.length ? 10 : 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>
                    {day}
                    {entries.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gold)", marginLeft: 8 }}>{entries.length} assigned</span>
                    )}
                  </div>
                  <button onClick={() => setActiveDay(isActive ? null : day)} style={{ ...navBtn, fontSize: 12, padding: "6px 12px", background: isActive ? "var(--gold)" : "var(--dark3)", color: isActive ? "#1a0e0e" : "var(--white)", fontWeight: 600 }}>
                    {isActive ? "Close" : "+ Add"}
                  </button>
                </div>

                {/* entries */}
                {entries.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(128,128,128,0.12)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAM_COLORS[e.team] || "#888", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: "var(--white)" }}>
                      <b>{e.name}</b> <span style={{ color: "var(--gray)" }}>· {e.team} · {e.shift}</span>
                    </div>
                    <button onClick={() => removeEntry(day, i)} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
                  </div>
                ))}

                {/* add form */}
                {isActive && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--dark3)", borderRadius: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 140px" }}>
                      <label style={miniLbl}>Staff</label>
                      <select value={selStaff} onChange={(e) => setSelStaff(e.target.value)} style={miniSelect}>
                        <option value="">Select…</option>
                        {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 110px" }}>
                      <label style={miniLbl}>Team</label>
                      <select value={selTeam} onChange={(e) => { setSelTeam(e.target.value); setSelShift(SHIFT_MODEL[e.target.value][0].shift); }} style={miniSelect}>
                        {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 110px" }}>
                      <label style={miniLbl}>Shift</label>
                      <select value={selShift} onChange={(e) => setSelShift(e.target.value)} style={miniSelect}>
                        {SHIFT_MODEL[selTeam].map((s) => <option key={s.shift} value={s.shift}>{s.shift} ({s.time})</option>)}
                      </select>
                    </div>
                    <button onClick={addEntry} style={{ ...primaryBtn, width: "auto", padding: "10px 18px", flex: "0 0 auto" }}>Add</button>
                  </div>
                )}

                {entries.length === 0 && !isActive && (
                  <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 6, opacity: 0.7 }}>No one assigned.</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 8, color: "var(--white)", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
const miniLbl: React.CSSProperties = { display: "block", fontSize: 10, color: "var(--gray)", marginBottom: 4 };
const miniSelect: React.CSSProperties = { width: "100%", padding: "9px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "var(--white)", fontSize: 13, boxSizing: "border-box" };