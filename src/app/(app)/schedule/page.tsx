"use client";
// Shifts: the team's rota by shift type (Prep / Morning / Mid / Evening), Week or Month view (remembered per device).
// Week = 7 full-width columns (a day list on phones); Month = calendar matrix. Own shifts highlighted.
// Times come from Settings → Shift times per date (Fri/Sat differ; Mid may be "time pending").
// Managers edit in the Roster editor (one editor, no duplicate logic here).
import { useEffect, useState } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/components/Skeleton";
import { PageHeader,  ErrorState } from "@/components/ui";
import { getTeamShiftsRange, type TeamShift } from "@/lib/queries/schedule";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { TEAMS } from "@/lib/queries/schedule-constants";
import { berlinToday, mondayOfDate } from "@/lib/time/berlinDate";

const KEY = "sch_shift_view";
const TYPES = ["prep", "morning", "mid", "evening", "other"] as const;
type Kind = (typeof TYPES)[number];
const kindOf = (s: TeamShift): Kind => s.team === "Preparation" ? "prep" : s.shift === "Morning" ? "morning" : s.shift === "Mid" ? "mid" : s.shift === "Night" || s.shift === "Evening" ? "evening" : "other";
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const addMonths = (d: string, n: number) => { const x = new Date(`${monthStart(d)}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };

export default function SchedulePage() {
  const { t, locale } = useLang();
  const de = locale === "de", loc = de ? "de-DE" : "en-GB";
  const teamLabel = (k: string) => (TEAMS.includes(k) ? t("teams." + k) : k);
  const kindLabel: Record<Kind, string> = de
    ? { prep: "Vorbereitung", morning: "Früh", mid: "Mitte", evening: "Spät", other: "Sonstige" }
    : { prep: "Preparation", morning: "Morning", mid: "Mid", evening: "Evening", other: "Other" };
  const today = berlinToday();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [shifts, setShifts] = useState<TeamShift[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null); // phone: the day whose colleagues are shown

  useEffect(() => { try { if (localStorage.getItem(KEY) === "month") setView("month"); } catch { /* ignore */ } }, []);
  function pick(v: "week" | "month") { setView(v); try { localStorage.setItem(KEY, v); } catch { /* ignore */ } }

  const from = view === "week" ? mondayOfDate(anchor) : mondayOfDate(monthStart(anchor));
  const to = view === "week" ? addDays(from, 6) : addDays(mondayOfDate(addDays(addMonths(anchor, 1), -1)), 6);
  useEffect(() => {
    let live = true;
    setLoading(true); setFailed(false);
    getTeamShiftsRange(from, to).then((r) => { if (!live) return; if (r.ok) { setShifts(r.shifts); setIsManager(r.isManager); } else setFailed(true); })
      .catch(() => live && setFailed(true)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [from, to]);

  const days: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  // day → kind → entries
  const grid = new Map<string, Map<Kind, TeamShift[]>>();
  for (const s of shifts) { const m = grid.get(s.date) ?? new Map(); const k = kindOf(s); m.set(k, [...(m.get(k) ?? []), s]); grid.set(s.date, m); }
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { timeZone: "UTC", ...o });
  const title = view === "week" ? `${fmt(from, { day: "2-digit", month: "short" })} – ${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}` : fmt(monthStart(anchor), { month: "long", year: "numeric" });
  const step = (n: number) => setAnchor(view === "week" ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const visible = view === "week" ? days : days.filter((d) => d.slice(0, 7) === anchor.slice(0, 7));
  const mine = shifts.filter((s) => s.mine && visible.includes(s.date)).length;
  const times = (list: TeamShift[]) => list.every((s) => s.pending) ? null : [...new Set(list.filter((s) => !s.pending).map((s) => `${s.start}–${s.end}`))].join(" / ");
  const rosterOffset = (d: string) => Math.round((Date.parse(mondayOfDate(d)) - Date.parse(mondayOfDate(today))) / (7 * 864e5));
  const pendingBadge = <span className="shift-badge is-pending">{t("roster.timePending")}</span>;

  return (
    <div className="fade-up shifts-page">
      <div className="shifts-head">
        <PageHeader title={ <><Icon e="📅" size={22} /> {t("shifts.title")}</> } />
        <div className="prep-seg shifts-toggle" role="group" aria-label={de ? "Ansicht" : "View"}>
          <button type="button" aria-pressed={view === "week"} onClick={() => pick("week")}>{de ? "Woche" : "Week"}</button>
          <button type="button" aria-pressed={view === "month"} onClick={() => pick("month")}>{de ? "Monat" : "Month"}</button>
        </div>
        <div className="shifts-nav">
          <button type="button" className="btn-secondary" aria-label={de ? "Zurück" : "Previous"} onClick={() => step(-1)}>‹</button>
          <strong>{title}</strong>
          <button type="button" className="btn-secondary" aria-label={de ? "Weiter" : "Next"} onClick={() => step(1)}>›</button>
          {!visible.includes(today) && <button type="button" className="btn-secondary" onClick={() => setAnchor(today)}>{de ? "Heute" : "Today"}</button>}
        </div>
        <span className="shifts-count">{de ? "Meine Schichten" : "My shifts"}: <strong>{mine}</strong></span>
        <Link href="/cover" className="btn-secondary">{t("cover.title")}</Link>
      </div>

      {failed ? <ErrorState message={t("common.loadFailed")} /> : loading ? <CardSkeleton rows={4} /> : view === "week" ? (
        <div className="shifts-week">
          {days.map((d) => {
            const byKind = grid.get(d);
            return (
              <section key={d} className={`shifts-day${d === today ? " is-today" : ""}${d < today ? " is-past" : ""}${openDay === d ? " is-open" : ""}${byKind ? "" : " is-empty"}`} aria-label={fmt(d, { weekday: "long", day: "2-digit", month: "long" })}>
                {/* Phone: the day is a compact row with your own shift; tap it to see who else is on. */}
                <h2 className="shifts-day-head"><button type="button" aria-expanded={openDay === d} disabled={!byKind} onClick={() => setOpenDay(openDay === d ? null : d)}>{fmt(d, { weekday: "short" })} <span>{fmt(d, { day: "2-digit", month: "short" })}</span>{byKind && <i aria-hidden="true">{openDay === d ? "▾" : "▸"}</i>}</button></h2>
                {TYPES.filter((k) => byKind?.get(k)).map((k) => {
                  const list = byKind!.get(k)!, tm = times(list);
                  return (
                    <div key={k} className={`shift-card kind-${k}${list.some((s) => s.mine) ? " is-mine" : ""}`}>
                      <div className="shift-card-top"><strong>{kindLabel[k]}</strong>{tm ? <span>{tm}</span> : pendingBadge}<small className="shift-card-n">{list.some((s) => s.mine) ? (de ? "Du" : "You") + (list.length > 1 ? ` +${list.length - 1}` : "") : list.length}</small></div>
                      <ul>{list.map((s, i) => <li key={i} className={s.mine ? "is-me" : undefined}>{s.mine ? (de ? "Du" : "You") : s.name}{k === "other" || (k !== "prep" && s.team !== "Kitchen") ? <em> · {teamLabel(s.team)}</em> : null}</li>)}</ul>
                    </div>
                  );
                })}
                {!byKind && <span className="shifts-off">{de ? "Keine Schichten" : "No shifts"}</span>}
                {isManager && <Link className="shifts-edit" href={`/roster?offset=${rosterOffset(d)}`}>{de ? "Im Dienstplan bearbeiten" : "Edit in roster"}</Link>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="shifts-month" role="grid" aria-label={title}>
          {days.slice(0, 7).map((d) => <div key={`h${d}`} className="shifts-month-wd" role="columnheader">{fmt(d, { weekday: "short" })}</div>)}
          {days.map((d) => {
            const byKind = grid.get(d);
            return (
              <div key={d} role="gridcell" className={`shifts-cell${d.slice(0, 7) !== anchor.slice(0, 7) ? " is-out" : ""}${d === today ? " is-today" : ""}${shifts.some((s) => s.mine && s.date === d) ? " has-mine" : ""}`}>
                <button type="button" className="shifts-cell-n" aria-label={fmt(d, { weekday: "long", day: "2-digit", month: "long" })} onClick={() => { setAnchor(d); setOpenDay(d); pick("week"); }}>{Number(d.slice(8))}</button>
                {TYPES.filter((k) => byKind?.get(k)).map((k) => {
                  const list = byKind!.get(k)!, tm = times(list);
                  return <div key={k} className={`shift-badge kind-${k}${list.some((s) => s.mine) ? " is-mine" : ""}`} title={`${kindLabel[k]}: ${list.map((s) => s.name).join(", ")}`}>
                    <strong>{tm ?? kindLabel[k]}</strong><span>{list.length}</span></div>;
                })}
              </div>
            );
          })}
        </div>
      )}
      {/* Phone, month view: the grid only shows dots, so your own shifts are listed underneath. */}
      {!loading && !failed && view === "month" && <ul className="shifts-mine-list">
        {shifts.filter((s) => s.mine && visible.includes(s.date)).sort((a, b) => a.date.localeCompare(b.date)).map((s, i) => { const k = kindOf(s); return (
          <li key={i} className={`shift-card kind-${k}`}><strong>{fmt(s.date, { weekday: "short", day: "2-digit", month: "short" })}</strong><span>{kindLabel[k]}</span>{s.pending ? pendingBadge : <span>{s.start}–{s.end}</span>}</li>); })}
        {mine === 0 && <li className="shifts-off">{de ? "Keine eigenen Schichten in diesem Monat" : "No shifts of your own this month"}</li>}
      </ul>}
      {!loading && !failed && <div className="shifts-legend" aria-hidden="true">{TYPES.slice(0, 4).map((k) => <span key={k} className={`shift-badge kind-${k}`}>{kindLabel[k]}</span>)}<span className="shift-badge is-mine">{de ? "Meine Schicht" : "My shift"}</span></div>}
    </div>
  );
}
