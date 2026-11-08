"use client";
// Managers: prepared vs. left over per item for a week or month (sent lists + evening counts).
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { Panel, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday } from "@/lib/time/berlinDate";
import { addDays } from "@/lib/inventory/prep-list";
import { getPrepHistory } from "@/lib/queries/prep-list";

type Result = Extract<Awaited<ReturnType<typeof getPrepHistory>>, { ok: true }>;
const monday = (d: string) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));

export default function PrepHistory() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const fmt = (n: number) => n.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1 });
  const today = berlinToday();
  const ranges = [
    { key: "week", label: s("This week", "Diese Woche"), from: monday(today), to: today },
    { key: "lastweek", label: s("Last week", "Letzte Woche"), from: addDays(monday(today), -7), to: addDays(monday(today), -1) },
    { key: "month", label: s("This month", "Dieser Monat"), from: `${today.slice(0, 7)}-01`, to: today },
    { key: "lastmonth", label: s("Last month", "Letzter Monat"), from: `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`, to: addDays(`${today.slice(0, 7)}-01`, -1) },
  ];
  const [range, setRange] = useState("week"), [data, setData] = useState<Result | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    const r = ranges.find((x) => x.key === range)!; setData(null); setError(false);
    getPrepHistory(r.from, r.to).then((x) => (x.ok ? setData(x) : setError(true))).catch(() => setError(true));
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Panel title={s("Prepared vs. left over", "Vorbereitet vs. übrig")} actions={<div className="row-actions" role="group" aria-label={s("Period", "Zeitraum")}>
    {ranges.map((r) => <button key={r.key} className={r.key === range ? "btn-gold" : "btn-secondary"} aria-pressed={r.key === range} onClick={() => setRange(r.key)}>{r.label}</button>)}</div>}>
    {error && <ErrorState message={s("History could not be loaded.", "Verlauf konnte nicht geladen werden.")} />}
    {!data && !error && <CardSkeleton rows={3} />}
    {data && (!data.rows.length ? <p>{s("No sent prep lists in this period.", "Keine gesendeten Listen in diesem Zeitraum.")}</p> : <>
      <p className="t-xs u-muted">{data.lists} {s("sent lists", "gesendete Listen")} · {s("Left over = counted the evening after; days without a count are excluded from the %.", "Übrig = am Abend danach gezählt; Tage ohne Zählung zählen nicht zur %.")}</p>
      <div className="table-scroll" role="region" aria-label={s("Prep history", "Vorbereitungsverlauf")} tabIndex={0}><table className="data-table">
        <thead><tr><th scope="col">{s("Item", "Artikel")}</th><th scope="col">{s("Days", "Tage")}</th><th scope="col">{s("Prepared", "Vorbereitet")}</th><th scope="col">{s("Left over", "Übrig")}</th><th scope="col">{s("Left %", "Rest %")}</th><th scope="col">{s("Changed by hand", "Manuell geändert")}</th></tr></thead>
        <tbody>{data.rows.map((r) => <tr key={r.item}>
          <th scope="row">{r.item}</th><td>{r.days}</td><td>{fmt(r.prepared)} {r.unit}</td>
          <td>{r.counted ? `${fmt(r.leftover)} ${r.unit}` : "—"}{r.counted < r.days ? <div className="t-xs u-muted">{r.counted}/{r.days} {s("counted", "gezählt")}</div> : null}</td>
          <td>{r.counted && r.preparedCounted ? `${fmt((r.leftover / r.preparedCounted) * 100)} %` : "—"}</td>
          <td>{r.overridden}×</td>
        </tr>)}</tbody>
      </table></div>
    </>)}
  </Panel>;
}
