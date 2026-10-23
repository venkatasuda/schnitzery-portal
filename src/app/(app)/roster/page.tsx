"use client";

import { useEffect, useRef, useState } from "react";
import { getRoster, saveRoster, getWeekStart } from "@/lib/queries/schedule";
import { SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

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
      <div className="d-flex jc-sb ai-c mb-4 gap-2 f-wrap">
        <div className="u-hstack">
          <button className="btn-secondary ui-btn-sm" disabled={loading||saving} onClick={() => changeWeek(-1)}>{t("shifts.prev")}</button>
          <span className="roster-week" aria-live="polite">
            {weekOffset === 0 ? t("roster.thisWeek") : weekOffset > 0 ? t("roster.weeksPlus", { n: weekOffset }) : t("roster.weeksMinus", { n: weekOffset })}
          </span>
          <button className="btn-secondary ui-btn-sm" disabled={loading||saving} onClick={() => changeWeek(1)}>{t("shifts.next")}</button>
        </div>
        <button className="btn-gold" onClick={doSave} disabled={saving||loading||!!loadError}>
          {saving ? t("common.saving") : t("roster.saveRoster")}
        </button>
      </div>

      {loadError ? null : loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* WEEK OVERVIEW STRIP (at-a-glance counts per day) */}
          <div className="card u-mb-3">
            <div className="card-title">{t("roster.weekGlance", { n: totalAssigned })}</div>
            <div className="roster-strip">
              {DAYS.map((d) => {
                const count = roster[d]?.length || 0;
                const isActive = activeDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(isActive ? null : d)}
                    className={`${count > 0 ? "has" : ""}${isActive ? " active" : ""}`}
                    aria-pressed={isActive}
                    aria-label={`${dayLabel(d)}: ${t("roster.assigned", { n: count })}`}
                  >
                    <span>{dayLabel(d).slice(0, 2)}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TEAM HOURS BOARD — month-to-date worked vs monthly contract */}
          <div className="card u-mb-3">
            <button className="ui-disclosure" onClick={() => setShowHours(!showHours)} aria-expanded={showHours}>
              <span className="card-title u-m0">{t("roster.teamHours")}</span>
              <span className="u-muted t-sm" aria-hidden="true">{showHours ? "▾" : "▸"}</span>
            </button>
            {showHours && (
              <div className="u-mt-3">
                <div className="ui-sub">{t("roster.teamHoursSub")}</div>
                {[...staff]
                  .filter((p) => p.contractHours != null || (p.workedH || 0) > 0)
                  .map((p) => ({ ...p, pct: p.contractHours ? Math.round(((p.workedH || 0) / p.contractHours) * 100) : null }))
                  .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
                  .map((p) => {
                    const over = p.pct != null && p.pct > 100;
                    const near = p.pct != null && p.pct >= 85 && p.pct <= 100;
                    const left = p.contractHours != null ? Math.round((p.contractHours - (p.workedH || 0)) * 10) / 10 : null;
                    return (
                      <div className="mb-3" key={p.id}>
                        <div className="d-flex jc-sb t-sm mb-1">
                          <span className="u-text">{p.full_name}</span>
                          <span className={over ? "tone-danger fw-7" : "u-muted"}>
                            {p.contractHours != null ? `${p.workedH || 0}/${p.contractHours}h` : `${p.workedH || 0}h`}
                            {left != null && (over ? ` · ${t("roster.over")}` : ` · ${left}${t("roster.leftShort")}`)}
                          </span>
                        </div>
                        {p.pct != null && (
                          <div className={`ui-bar${over ? " over" : near ? " near" : ""}`} role="img" aria-label={`${p.pct}%`}>
                            <span style={{ width: `${Math.min(100, p.pct)}%` }} />
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
              <div key={day} className={`card roster-day${isActive ? " active" : ""}`}>
                <div className="roster-day-head">
                  <div className="t-lg fw-7 u-text">
                    {dayLabel(day)}
                    {entries.length > 0 && (
                      <span className="t-xs fw-6 tone-action ml-2">{t("roster.assigned", { n: entries.length })}</span>
                    )}
                  </div>
                  <button className={`${isActive ? "btn-gold" : "btn-secondary"} ui-btn-sm`} onClick={() => setActiveDay(isActive ? null : day)} aria-expanded={isActive}>
                    {isActive ? t("common.close") : t("roster.add")}
                  </button>
                </div>

                {/* entries */}
                {entries.map((e, i) => (
                  <div key={i} className="roster-entry">
                    <span className="clock-dot" style={{ color: TEAM_COLORS[e.team] || "#888" }} aria-hidden="true" />
                    <div className="u-flex1 t-sm u-text">
                      <b>{e.name}</b> <span className="u-muted">· {teamLabel(e.team)} · {shiftLabel(e.shift)}</span>
                    </div>
                    {submitted(e.user_id) && !availableDay(e.user_id, day) && (
                      <span className="ui-tag-warn u-nowrap">⚠ {t("roster.notAvail")}</span>
                    )}
                    <button disabled={saving} aria-label={t("roster.removeShift",{name:e.name})} onClick={() => removeEntry(day, i)} className="ui-remove-btn">×</button>
                  </div>
                ))}

                {/* add form */}
                {isActive && (
                  <div className="roster-form">
                    <Field label={t("roster.staff")}>
                      <select className="form-input" value={selStaff} onChange={(e) => setSelStaff(e.target.value)}>
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
                    </Field>
                    <Field label={t("roster.team")}>
                      <select className="form-input" value={selTeam} onChange={(e) => { const tm = e.target.value; setSelTeam(tm); setSelShift(presetsFor(tm)[0]?.shift ?? CUSTOM); }}>
                        {TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                      </select>
                    </Field>
                    <Field label={t("roster.shift")}>
                      <select className="form-input" value={selShift} onChange={(e) => setSelShift(e.target.value)}>
                        {presetsFor(selTeam).map((s) => <option key={s.shift} value={s.shift}>{shiftLabel(s.shift)} ({s.time})</option>)}
                        <option value={CUSTOM}>{t("roster.customTime")}</option>
                      </select>
                    </Field>
                    {selShift === CUSTOM && (
                      <div className="roster-times">
                        <Field label={t("roster.from")}><input className="form-input" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></Field>
                        <Field label={t("roster.to")}><input className="form-input" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></Field>
                      </div>
                    )}
                    <button className="btn-gold" onClick={addEntry}>{t("common.add")}</button>
                  </div>
                )}

                {entries.length === 0 && !isActive && (
                  <div className="t-xs u-muted mt-2">{t("roster.noOne")}</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
