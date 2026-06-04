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

  if (denied) {
    return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Only managers can edit the roster.</div>;
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📋 Weekly Roster</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Assign staff to shifts. {weekLabel}</p>

      {/* week nav + save */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => changeWeek(-1)} style={navBtn}>‹ Prev</button>
          <button onClick={() => changeWeek(1)} style={navBtn}>Next ›</button>
        </div>
        <button onClick={doSave} disabled={saving} style={{ ...primaryBtn, width: "auto", padding: "10px 24px" }}>
          {saving ? "Saving…" : "💾 Save Roster"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      ) : (
        DAYS.map((day) => {
          const entries = roster[day] || [];
          const isActive = activeDay === day;
          return (
            <div key={day} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entries.length ? 10 : 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{day}</div>
                <button onClick={() => setActiveDay(isActive ? null : day)} style={{ ...navBtn, fontSize: 12, padding: "6px 12px" }}>
                  {isActive ? "Close" : "+ Add"}
                </button>
              </div>

              {/* entries */}
              {entries.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAM_COLORS[e.team] || "#888" }} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <b>{e.name}</b> <span style={{ color: "#9a8f8f" }}>· {e.team} · {e.shift}</span>
                  </div>
                  <button onClick={() => removeEntry(day, i)} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              ))}

              {/* add form */}
              {isActive && (
                <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
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
                <div style={{ fontSize: 12, color: "#6f6565", marginTop: 6 }}>No one assigned.</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const navBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
const miniLbl: React.CSSProperties = { display: "block", fontSize: 10, color: "#9a8f8f", marginBottom: 4 };
const miniSelect: React.CSSProperties = { width: "100%", padding: "9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13, boxSizing: "border-box" };