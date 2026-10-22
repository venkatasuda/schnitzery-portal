"use client";

import { useEffect, useRef, useState } from "react";
import { getRoster, saveRoster, getWeekStart } from "@/lib/queries/schedule";
import { SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Every team a manager can roster — not only the ones that happen to have preset
// shift times. Teams without presets simply use a custom start/end time.
const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier", "Dishwashing"];
const TEAM_COLORS: Record<string, string> = { Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)", Cashier: "#9b59b6", Dishwashing: "var(--info)" };
const CUSTOM = "__custom__";
const presetsFor = (team: string) => SHIFT_MODEL[team] || [];

type Entry = { user_id: string; name: string; team: string; shift: string };
type Roster = Record<string, Entry[]>;

export default function RosterPage() {
  const { t } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier", "Dishwashing"].includes(k) ? t("teams." + k) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [roster, setRoster] = useState<Roster>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [avail, setAvail] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expected,setExpected] = useState<{id:string;roster:any}|null>(null);
  const loadSerial=useRef(0);

  // add-shift form (per selected day)
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [selStaff, setSelStaff] = useState("");
  const [selTeam, setSelTeam] = useState(TEAMS[0]);
  const [selShift, setSelShift] = useState(presetsFor(TEAMS[0])[0]?.shift ?? CUSTOM);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("17:00");

  async function load(offset: number) {
    const serial=++loadSerial.current;
    setLoading(true);
    setLoadError("");
    try {
      const ws = await getWeekStart(offset);
      const res = await getRoster(ws);
      if(serial!==loadSerial.current)return;
      if (!res.ok) { if (res.error?.includes("managers")) setDenied(true); throw Error(res.error); }
      setWeekStart(res.weekStart || ""); setRoster(res.roster || {}); setExpected(res.expected || null);
      setStaff(res.staff || []); setAvail((res as any).avail || {});
    } catch { if(serial===loadSerial.current)setLoadError(t("roster.loadFailed")); }
    finally { if(serial===loadSerial.current)setLoading(false); }
  }

  useEffect(() => { load(0); return()=>{loadSerial.current++;}; }, []);

  function changeWeek(delta: number) {
    if(saving || loading)return;
    if(JSON.stringify(roster)!==JSON.stringify(expected?.roster || {}) && !confirm(t("roster.discardChanges")))return;
    const next = weekOffset + delta;
    setWeekOffset(next);
    load(next);
  }

  function addEntry() {
    if(saving || loadError)return;
    if (!activeDay || !selStaff) { toast(t("roster.pickStaff"), "error"); return; }
    const person = staff.find((p) => p.id === selStaff);
    if (!person) return;
    // Custom time → store the actual "HH:MM–HH:MM" range as the shift value.
    let shiftVal = selShift;
    if (selShift === CUSTOM) {
      if (!customStart || !customEnd) { toast(t("roster.badTime"), "error"); return; }
      shiftVal = `${customStart}–${customEnd}`;
    }
    const entry: Entry = { user_id: person.id, name: person.full_name, team: selTeam, shift: shiftVal };
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
    if(saving || loading || loadError)return;
    setSaving(true);
    try {
      const res = await saveRoster(weekStart, roster, expected);
      if (res.ok && res.expected) { setExpected(res.expected); setRoster(res.expected.roster); toast(t("roster.saved"), "success"); }
      else { const code = (res as { code?: string }).code; toast(code ? t(`roster.${code}`) : (res.error || t("roster.saveFailed")), "error"); }
    } catch { toast(t("roster.saveFailed"),"error"); }
    finally { setSaving(false); }
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  const totalAssigned = DAYS.reduce((sum, d) => sum + (roster[d]?.length || 0), 0);

  // availability helpers for this week
  const submitted = (uid: string) => !!avail[uid];
  const availableDay = (uid: string, day: string) => Array.isArray(avail[uid]?.[day]) && avail[uid][day].length > 0;

  if (denied) {
    return <div className="card ui-denied">{t("roster.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📋" size={22} /> {t("roster.title")}</h1>
      <div className="page-sub">{t("roster.subtitle", { week: weekLabel || "…" })}</div>
      {loadError && <div role="alert" className="card"><p>{loadError}</p><button className="btn-secondary" onClick={()=>load(weekOffset)}>{t("business.retry")}</button></div>}

      {/* week nav + save */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div className="u-hstack">
          <button disabled={loading||saving} onClick={() => changeWeek(-1)} style={navBtn}>{t("shifts.prev")}</button>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, color: "var(--action)", fontWeight: 600, padding: "0 4px" }}>
            {weekOffset === 0 ? t("roster.thisWeek") : weekOffset > 0 ? t("roster.weeksPlus", { n: weekOffset }) : t("roster.weeksMinus", { n: weekOffset })}
          </span>
          <button disabled={loading||saving} onClick={() => changeWeek(1)} style={navBtn}>{t("shifts.next")}</button>
        </div>
        <button onClick={doSave} disabled={saving||loading||!!loadError} style={{ ...primaryBtn, width: "auto", padding: "10px 24px", opacity: saving ? 0.6 : 1 }}>
          {saving ? t("common.saving") : t("roster.saveRoster")}
        </button>
      </div>

      {loadError ? null : loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* WEEK OVERVIEW STRIP (at-a-glance counts per day) */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">{t("roster.weekGlance", { n: totalAssigned })}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
              {DAYS.map((d) => {
                const count = roster[d]?.length || 0;
                const isActive = activeDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(isActive ? null : d)}
                    style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8, border: "none", cursor: "pointer", background: isActive ? "var(--accent-soft)" : count > 0 ? "var(--dark3)" : "transparent" }}
                  >
                    <div style={{ fontSize: 12, color: isActive ? "var(--action)" : "var(--gray)", fontWeight: isActive ? 700 : 500 }}>{dayLabel(d)[0]}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: count > 0 ? "var(--white)" : "rgba(128,128,128,0.4)" }}>{count}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TEAM HOURS BOARD — month-to-date worked vs monthly contract */}
          <div className="card" style={{ marginBottom: 12 }}>
            <button onClick={() => setShowHours(!showHours)} style={{ width: "100%", background: "none", border: "none", color: "var(--white)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
              <span className="card-title u-m0">{t("roster.teamHours")}</span>
              <span style={{ color: "var(--gray)", fontSize: 13 }}>{showHours ? "▾" : "▸"}</span>
            </button>
            {showHours && (
              <div style={{ marginTop: 10 }}>
                <div className="ui-sub">{t("roster.teamHoursSub")}</div>
                {[...staff]
                  .filter((p) => p.contractHours != null || (p.workedH || 0) > 0)
                  .map((p) => ({ ...p, pct: p.contractHours ? Math.round(((p.workedH || 0) / p.contractHours) * 100) : null }))
                  .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
                  .map((p) => {
                    const over = p.pct != null && p.pct > 100;
                    const near = p.pct != null && p.pct >= 85 && p.pct <= 100;
                    const barColor = over ? "#e74c3c" : near ? "var(--action)" : "#27ae60";
                    const left = p.contractHours != null ? Math.round((p.contractHours - (p.workedH || 0)) * 10) / 10 : null;
                    return (
                      <div key={p.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span className="u-text">{p.full_name}</span>
                          <span style={{ color: over ? "var(--danger)" : "var(--gray)", fontWeight: over ? 700 : 500 }}>
                            {p.contractHours != null ? `${p.workedH || 0}/${p.contractHours}h` : `${p.workedH || 0}h`}
                            {left != null && (over ? ` · ${t("roster.over")}` : ` · ${left}${t("roster.leftShort")}`)}
                          </span>
                        </div>
                        {p.pct != null && (
                          <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, p.pct)}%`, background: barColor, borderRadius: 3 }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          {DAYS.map((day) => {
            const entries = roster[day] || [];
            const isActive = activeDay === day;
            return (
              <div key={day} className="card" style={{ marginBottom: 10, borderColor: isActive ? "var(--accent-line)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entries.length ? 10 : 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>
                    {dayLabel(day)}
                    {entries.length > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--action)", marginLeft: 8 }}>{t("roster.assigned", { n: entries.length })}</span>
                    )}
                  </div>
                  <button onClick={() => setActiveDay(isActive ? null : day)} style={{ ...navBtn, fontSize: 12, padding: "6px 12px", background: isActive ? "var(--action)" : "var(--dark3)", color: isActive ? "var(--on-action)" : "var(--white)", fontWeight: 600 }}>
                    {isActive ? t("common.close") : t("roster.add")}
                  </button>
                </div>

                {/* entries */}
                {entries.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAM_COLORS[e.team] || "#888", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: "var(--white)" }}>
                      <b>{e.name}</b> <span className="u-muted">· {teamLabel(e.team)} · {shiftLabel(e.shift)}</span>
                    </div>
                    {submitted(e.user_id) && !availableDay(e.user_id, day) && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e0a32e", background: "rgba(224,163,46,0.15)", border: "1px solid rgba(224,163,46,0.35)", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>⚠ {t("roster.notAvail")}</span>
                    )}
                    <button disabled={saving} aria-label={t("roster.removeShift",{name:e.name})} onClick={() => removeEntry(day, i)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 18, lineHeight: 1, minWidth:44, minHeight:44 }}>×</button>
                  </div>
                ))}

                {/* add form */}
                {isActive && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--dark3)", borderRadius: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 140px" }}>
                      <label style={miniLbl}>{t("roster.staff")}</label>
                      <select aria-label={t("roster.staff")} value={selStaff} onChange={(e) => setSelStaff(e.target.value)} style={miniSelect}>
                        <option value="">{t("roster.select")}</option>
                        {[...staff].sort((a, b) => (availableDay(a.id, day) ? 0 : 1) - (availableDay(b.id, day) ? 0 : 1) || (a.full_name || "").localeCompare(b.full_name || "")).map((p) => {
                          const tag = availableDay(p.id, day) ? t("roster.avAvailable") : submitted(p.id) ? t("roster.avNot") : t("roster.avNone");
                          const wh = (p as any).workedH ?? 0; const ch = (p as any).contractHours;
                          const hrs = ch != null
                            ? ` · ${wh}/${ch}h${ch - wh > 0 ? ` (${Math.round((ch - wh) * 10) / 10} ${t("roster.leftWord")})` : ch - wh < 0 ? ` (${t("roster.over")})` : ""}`
                            : ` · ${wh}h`;
                          return <option key={p.id} value={p.id}>{p.full_name} — {tag}{hrs}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 110px" }}>
                      <label style={miniLbl}>{t("roster.team")}</label>
                      <select aria-label={t("roster.team")} value={selTeam} onChange={(e) => { const tm = e.target.value; setSelTeam(tm); setSelShift(presetsFor(tm)[0]?.shift ?? CUSTOM); }} style={miniSelect}>
                        {TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 110px" }}>
                      <label style={miniLbl}>{t("roster.shift")}</label>
                      <select aria-label={t("roster.shift")} value={selShift} onChange={(e) => setSelShift(e.target.value)} style={miniSelect}>
                        {presetsFor(selTeam).map((s) => <option key={s.shift} value={s.shift}>{shiftLabel(s.shift)} ({s.time})</option>)}
                        <option value={CUSTOM}>{t("roster.customTime")}</option>
                      </select>
                    </div>
                    {selShift === CUSTOM && (
                      <div style={{ flex: "1 1 180px", display: "flex", gap: 6, alignItems: "flex-end" }}>
                        <div className="u-flex1">
                          <label style={miniLbl}>{t("roster.from")}</label>
                          <input type="time" aria-label={t("roster.from")} value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={miniSelect} />
                        </div>
                        <div className="u-flex1">
                          <label style={miniLbl}>{t("roster.to")}</label>
                          <input type="time" aria-label={t("roster.to")} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={miniSelect} />
                        </div>
                      </div>
                    )}
                    <button onClick={addEntry} style={{ ...primaryBtn, width: "auto", padding: "10px 18px", flex: "0 0 auto" }}>{t("common.add")}</button>
                  </div>
                )}

                {entries.length === 0 && !isActive && (
                  <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 6, opacity: 0.7 }}>{t("roster.noOne")}</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--dark3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };
const miniLbl: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 4 };
const miniSelect: React.CSSProperties = { width: "100%", padding: "9px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 13, boxSizing: "border-box" };
