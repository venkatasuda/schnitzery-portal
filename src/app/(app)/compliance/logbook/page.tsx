"use client";
// Hygiene logbook for food inspection: temperatures per day and unit, cleaning/checklist tasks per day.
// "Print / save as PDF" uses the browser's print dialog with a print layout (no PDF library needed).
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, Panel, Field, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { addDays } from "@/lib/inventory/prep-list";
import { getHygieneLog } from "@/lib/queries/hygiene-log";

type Data = Extract<Awaited<ReturnType<typeof getHygieneLog>>, { ok: true }>;
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

export default function HygieneLogbookPage() {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const today = berlinToday();
  const presets = [
    { key: "30", label: s("Last 30 days", "Letzte 30 Tage"), from: addDays(today, -29), to: today },
    { key: "month", label: s("This month", "Dieser Monat"), from: monthStart(today), to: today },
    { key: "last", label: s("Last month", "Letzter Monat"), from: monthStart(addDays(monthStart(today), -1)), to: addDays(monthStart(today), -1) },
  ];
  const [from, setFrom] = useState(presets[0].from), [to, setTo] = useState(today);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    getHygieneLog(from, to).then((r) => (r.ok ? setData(r) : setError(r.error))).catch(() => setError("load"));
  }, [from, to]);

  const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString(de ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "";
  const deg = (n: number) => `${n.toLocaleString(de ? "de-DE" : "en-GB", { maximumFractionDigits: 1 })} °C`;
  const dates: string[] = [];
  if (data) for (let d = data.from; d <= data.to; d = addDays(d, 1)) dates.push(d);

  const tempsBy = new Map<string, Data["temps"]>();
  const tasksBy = new Map<string, Data["tasks"]>();
  for (const t of data?.temps ?? []) { const k = `${t.work_date}|${t.unit_id}`; tempsBy.set(k, [...(tempsBy.get(k) ?? []), t]); }
  for (const t of data?.tasks ?? []) tasksBy.set(t.work_date, [...(tasksBy.get(t.work_date) ?? []), t]);
  // A unit only counts from the day it was added (readings before that, if any, still show).
  const due = (d: string, u: Data["units"][number]) => d >= u.since || tempsBy.has(`${d}|${u.id}`);
  const cells = data ? dates.reduce((n, d) => n + data.units.filter((u) => due(d, u)).length, 0) : 0;
  // Two checks a day: before 15:00 = opening, from 15:00 = closing (same rule as the Temperature log and day close).
  const closing = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date(iso))) >= 15;
  const missing = (list: Data["temps"]) => [!list.some((t) => !closing(t.recorded_at)) && s("opening", "Öffnung"), !list.some((t) => closing(t.recorded_at)) && s("closing", "Schluss")].filter(Boolean) as string[];
  const covered = data ? dates.reduce((n, d) => n + data.units.filter((u) => { const l = tempsBy.get(`${d}|${u.id}`); return l && !missing(l).length; }).length, 0) : 0;
  const outOfRange = data?.temps.filter((t) => !t.in_range) ?? [];
  const doneTasks = data?.tasks.filter((t) => t.done).length ?? 0;

  return <div className="logbook">
    <div className="no-print">
      <PageHeader title={s("Hygiene logbook", "Hygiene-Protokoll")}
        actions={<button className="btn-gold" disabled={!data} onClick={() => window.print()}>{s("Print / save as PDF", "Drucken / als PDF speichern")}</button>} />
      <div className="row-actions" role="group" aria-label={s("Period", "Zeitraum")}>
        {presets.map((p) => <button key={p.key} className={p.from === from && p.to === to ? "btn-gold" : "btn-secondary"} aria-pressed={p.from === from && p.to === to} onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>)}
        <Field label={s("From", "Von")}><input className="form-input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label={s("To", "Bis")}><input className="form-input" type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
      </div>
    </div>

    {error && <ErrorState message={error === "range" ? s("Choose at most 93 days.", "Höchstens 93 Tage wählen.") : error === "access" ? s("For managers only.", "Nur für die Leitung.") : s("Logbook could not be loaded.", "Protokoll konnte nicht geladen werden.")} />}
    {!data && !error && <CardSkeleton rows={6} />}
    {data && <>
      <header className="logbook-head">
        <h1>{s("Hygiene logbook (HACCP)", "Hygiene-Protokoll (HACCP)")} · {data.branchName}</h1>
        <p>{fmtDay(data.from, locale)} – {fmtDay(data.to, locale)} · {s("printed", "gedruckt")} {new Date().toLocaleString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <ul className="logbook-summary">
          <li>{s("Temperature checks", "Temperaturkontrollen")}: <strong>{covered} / {cells}</strong> {s("unit-days with opening + closing check", "Geräte-Tage mit Öffnungs- und Schlusskontrolle")}</li>
          <li>{s("Out of range", "Außerhalb des Bereichs")}: <strong>{outOfRange.length}</strong>{outOfRange.length ? ` (${outOfRange.filter((t) => t.corrective_action).length} ${s("with corrective action", "mit Korrekturmaßnahme")})` : ""}</li>
          <li>{s("Checklist tasks done", "Erledigte Checklisten-Aufgaben")}: <strong>{doneTasks} / {data.tasks.length}</strong></li>
        </ul>
      </header>

      <Panel title={s("Temperatures", "Temperaturen")}>
        {!data.units.length ? <p>{s("No fridges or freezers set up.", "Keine Kühlgeräte eingerichtet.")}</p> :
        <div className="table-scroll" role="region" aria-label={s("Temperatures", "Temperaturen")} tabIndex={0}><table className="data-table logbook-table">
          <thead><tr><th scope="col">{s("Date", "Datum")}</th>{data.units.map((u) => <th scope="col" key={u.id}>{u.name}<div className="t-xs u-muted">{deg(u.min_temp)} … {deg(u.max_temp)}</div></th>)}</tr></thead>
          <tbody>{dates.map((d) => <tr key={d}><th scope="row">{fmtDay(d, locale)}</th>{data.units.map((u) => {
            const list = tempsBy.get(`${d}|${u.id}`);
            if (!due(d, u)) return <td key={u.id} className="u-muted">—</td>;
            const gap = list ? missing(list) : [];
            return <td key={u.id} className={!list || gap.length ? "logbook-missing" : list.some((t) => !t.in_range) ? "logbook-bad" : undefined}>
              {gap.length > 0 && <div className="t-xs">{s("missing", "fehlt")}: {gap.join(", ")}</div>}
              {!list ? s("not logged", "nicht erfasst") : list.map((t, i) => <div key={i}>{deg(t.temp)} · {time(t.recorded_at)}{t.recorded_by_name ? ` · ${t.recorded_by_name}` : ""}{!t.in_range && <div className="t-xs">{s("Action", "Maßnahme")}: {t.corrective_action || s("none recorded", "keine erfasst")}</div>}</div>)}
            </td>;
          })}</tr>)}</tbody>
        </table></div>}
      </Panel>

      <Panel title={s("Cleaning & checklists", "Reinigung & Checklisten")}>
        {dates.map((d) => {
          const list = tasksBy.get(d) ?? [];
          const open = list.filter((t) => !t.done);
          return <section key={d} className="logbook-day">
            <h3>{fmtDay(d, locale)} · {list.length ? `${list.length - open.length} / ${list.length} ${s("done", "erledigt")}` : s("no checklist recorded", "keine Checkliste erfasst")}</h3>
            {list.length > 0 && <table className="data-table logbook-table"><tbody>{list.map((t, i) => <tr key={i} className={t.done ? undefined : "logbook-bad"}>
              <td>{t.done ? "✓" : "✗"}</td><td>{t.type ?? ""}</td><td>{t.task}{t.value ? ` · ${t.value}` : ""}</td><td>{t.done ? `${t.completed_by_name ?? ""} ${time(t.completed_at)}` : s("not done", "nicht erledigt")}</td>
            </tr>)}</tbody></table>}
          </section>;
        })}
      </Panel>
      <p className="logbook-sign">{s("Checked by (name, signature)", "Geprüft von (Name, Unterschrift)")}: ______________________________</p>
    </>}
  </div>;
}
