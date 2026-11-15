"use client";
// Working-time record (Arbeitszeitnachweis, § 16 ArbZG) for one person and month — print / save as PDF through the
// browser, same print layout as the hygiene logbook. ?month=YYYY-MM, managers add &user=<id>.
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { serverText } from "@/lib/i18n/serverMessages";
import { fmtDay } from "@/lib/time/berlinDate";
import { getWorkingTimeRecord } from "@/lib/queries/timepay";
import { workingTimeRecord, hhmm } from "@/lib/pay/workingTime";

type Data = Extract<Awaited<ReturnType<typeof getWorkingTimeRecord>>, { ok: true }>;

export default function WorkingTimeRecordPage() {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const [query, setQuery] = useState<{ month?: string; user?: string } | null>(null);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");
  useEffect(() => { const q = new URLSearchParams(window.location.search); setQuery({ month: q.get("month") || undefined, user: q.get("user") || undefined }); }, []);
  useEffect(() => {
    if (!query) return;
    setData(null); setError("");
    getWorkingTimeRecord(query.month, query.user).then((r) => (r.ok ? setData(r) : setError(serverText(r.error, locale) || r.error)), () => setError(s("Could not load the record.", "Der Nachweis konnte nicht geladen werden.")));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (n: number) => {
    if (!data) return;
    const [y, m] = data.month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + n, 15));
    const month = d.toISOString().slice(0, 7), url = new URL(window.location.href);
    url.searchParams.set("month", month); window.history.replaceState(null, "", url); setQuery((q) => ({ ...q, month }));
  };
  const rec = data ? workingTimeRecord(data.logs) : null;
  const monthLabel = data ? new Date(`${data.month}-15T12:00:00Z`).toLocaleDateString(de ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const stateLabel = { approved: s("approved", "freigegeben"), pending: s("pending approval", "Freigabe offen"), open: s("still open", "noch offen"), needs_fix: s("end time missing", "Ende fehlt") };

  return (
    <div className="logbook">
      <div className="no-print">
        <PageHeader title={s("Working-time record", "Arbeitszeitnachweis")} subtitle={data ? `${data.person.name} · ${monthLabel}` : undefined}
          actions={<button className="btn-gold" disabled={!data} onClick={() => window.print()}>{s("Print / save as PDF", "Drucken / als PDF speichern")}</button>} />
        <div className="row-actions">
          <button className="btn-secondary ui-btn-sm" disabled={!data} onClick={() => move(-1)}>‹ {s("Previous month", "Vormonat")}</button>
          <button className="btn-secondary ui-btn-sm" disabled={!data} onClick={() => move(1)}>{s("Next month", "Nächster Monat")} ›</button>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : !data || !rec ? <CardSkeleton rows={6} /> : <section className="card">
        <h2>{s("Working-time record", "Arbeitszeitnachweis")} · {monthLabel}</h2>
        <p>{data.person.name}{data.person.code ? ` · ${s("No.", "Pers.-Nr.")} ${data.person.code}` : ""}{data.branch ? ` · ${data.branch}` : ""}</p>
        <div className="table-scroll">
          <table className="data-table logbook-table">
            <thead><tr>{[s("Date", "Datum"), s("Start", "Beginn"), s("End", "Ende"), s("Breaks", "Pausen"), s("Worked", "Arbeitszeit"), s("Status", "Status")].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rec.rows.map((r, i) => <tr key={i}><td>{fmtDay(r.date, locale)}</td><td className="inv-mono">{r.start}</td><td className="inv-mono">{r.end}</td>
                <td className="inv-mono">{r.breakMin == null ? "—" : `${r.breakMin} min`}</td><td className="inv-mono">{hhmm(r.paidMin)}</td>
                <td className={r.state === "open" || r.state === "needs_fix" ? "logbook-bad" : undefined}>{stateLabel[r.state]}</td></tr>)}
              {!rec.rows.length && <tr><td colSpan={6}>{s("No shifts recorded this month.", "Keine Schichten in diesem Monat erfasst.")}</td></tr>}
            </tbody>
            <tfoot><tr><th scope="row" colSpan={4}>{s("Total", "Summe")} · {rec.days} {s("days", "Tage")}</th><td className="inv-mono"><strong>{hhmm(rec.totalMin)}</strong></td><td>{s("approved", "freigegeben")} {hhmm(rec.approvedMin)}</td></tr></tfoot>
          </table>
        </div>
        {rec.unresolved > 0 && <p className="logbook-bad">{s(`${rec.unresolved} shift(s) without a final end time are not counted until corrected.`, `${rec.unresolved} Schicht(en) ohne endgültiges Ende werden erst nach Korrektur gezählt.`)}</p>}
        <p className="logbook-sign">{s("Employee", "Mitarbeiter/in")}: ______________________ &nbsp; {s("Employer", "Arbeitgeber")}: ______________________ &nbsp; {s("Date", "Datum")}: __________</p>
      </section>}
    </div>
  );
}
