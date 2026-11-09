"use client";
// End-of-day close (shift leaders + managers): POS report, counted cash, and the day's checks.
// Open points need a short reason; once closed, the day is read-only.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, Panel, Field, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { formatEur } from "@/lib/format";
import { addDays } from "@/lib/inventory/prep-list";
import { getDayClose, closeDay, type DaySnapshot } from "@/lib/queries/day-close";

type Data = Extract<Awaited<ReturnType<typeof getDayClose>>, { ok: true }>;
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export default function DayClosePage() {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const eur = (v: number | null) => (v == null ? "—" : formatEur(v, locale, 2));
  const [day, setDay] = useState(berlinToday());
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [posTotal, setPosTotal] = useState(""), [posCash, setPosCash] = useState(""), [counted, setCounted] = useState(""), [note, setNote] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function load(d: string) {
    setError("");
    try { const r = await getDayClose(d); if (r.ok) setData(r); else { setData(null); setError(r.error); } } catch { setError("load"); }
  }
  useEffect(() => { void load(day); setReasons({}); setPosTotal(""); setPosCash(""); setCounted(""); setNote(""); }, [day]);

  if (error === "access") return <ErrorState message={s("The day close is for shift leaders and managers.", "Der Tagesabschluss ist für Schichtleitung und Leitung.")} />;
  if (!data) return error ? <ErrorState message={s("Day close could not be loaded.", "Tagesabschluss konnte nicht geladen werden.")} onRetry={() => load(day)} retryLabel={s("Retry", "Erneut versuchen")} /> : <CardSkeleton rows={6} />;

  const snap: DaySnapshot = data.closed?.snapshot ?? data.snapshot;
  const diff = num(counted) != null && num(posCash) != null ? Math.round((num(counted)! - num(posCash)!) * 100) / 100 : null;
  const checks: { key: string; ok: boolean; label: string; value: string; link?: string }[] = [
    // Same rule as private.close_day: entered, and equal to any figure already in daily_sales.
    { key: "sales", ok: data.closed ? !(data.closed.snapshot.open_points ?? []).includes("sales") : num(posTotal) != null && (snap.recorded_sales == null || Math.abs(num(posTotal)! - Number(snap.recorded_sales)) < 0.01), label: s("POS sales", "Kassenumsatz"), value: eur(data.closed ? data.closed.pos_total : num(posTotal)) },
    { key: "cash", ok: data.closed ? data.closed.cash_difference === 0 : diff === 0, label: s("Cash difference", "Kassendifferenz"), value: eur(data.closed ? data.closed.cash_difference : diff) },
    { key: "temps", ok: snap.temps.logged >= snap.temps.units, label: s("Temperatures", "Temperaturen"), value: `${snap.temps.logged} / ${snap.temps.units}`, link: "/temp" },
    { key: "checklists", ok: snap.checklists.done >= snap.checklists.total, label: s("Checklists", "Checklisten"), value: `${snap.checklists.done} / ${snap.checklists.total}`, link: "/checklist" },
    { key: "leftovers", ok: snap.leftovers.counted >= snap.leftovers.items, label: s("Prep leftovers counted", "Vorbereitungsreste gezählt"), value: `${snap.leftovers.counted} / ${snap.leftovers.items}`, link: "/prep" },
    ...(snap.leftovers.items > 0 ? [{ key: "prep_list", ok: snap.next_prep_list === "sent", label: s("Tomorrow's prep list", "Vorbereitungsliste morgen"), value: snap.next_prep_list === "sent" ? s("sent", "gesendet") : snap.next_prep_list === "draft" ? s("draft", "Entwurf") : s("not planned", "nicht geplant"), link: "/prep" }] : []),
    { key: "clocked_in", ok: snap.clocked_in.length === 0, label: s("Still clocked in", "Noch eingestempelt"), value: snap.clocked_in.length ? snap.clocked_in.map((p) => `${p.name} (${new Date(p.since).toLocaleTimeString(de ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })})`).join(", ") : s("nobody", "niemand") },
  ];
  const open = checks.filter((c) => !c.ok);
  const missingReason = open.some((c) => (reasons[c.key] ?? "").trim().length < 3);

  async function submit() {
    if (busy || !data || missingReason) return;
    if (!window.confirm(s("Close this day? It cannot be changed afterwards.", "Diesen Tag abschließen? Danach ist keine Änderung mehr möglich."))) return;
    setBusy(true); setError("");
    try {
      const r = await closeDay(data.branch.id, day, num(posTotal), num(posCash), num(counted), reasons, note);
      if (!r.ok) { setError(r.error === "reason" ? `reason:${r.missing}` : r.error); return; }
      await load(day);
    } catch { setError("save"); } finally { setBusy(false); }
  }
  const errText = error.startsWith("reason:") ? s("A reason is missing for an open point.", "Für einen offenen Punkt fehlt ein Grund.")
    : error === "closed" ? s("This day was already closed by someone else. Reloaded.", "Dieser Tag wurde bereits abgeschlossen. Neu geladen.")
    : error === "cash" ? s("POS cash cannot be higher than POS total.", "Bar laut Kasse kann nicht höher als der Gesamtumsatz sein.")
    : error ? s("Not closed. Check the numbers and retry.", "Nicht abgeschlossen. Zahlen prüfen und erneut versuchen.") : "";

  return <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <PageHeader title={s("Close the day", "Tagesabschluss")} subtitle={`${data.branch.name} · ${fmtDay(day, locale)}`} />
    <div className="row-actions" role="group" aria-label={s("Day", "Tag")}>
      {[berlinToday(), addDays(berlinToday(), -1)].map((d, i) => <button key={d} className={d === day ? "btn-gold" : "btn-secondary"} aria-pressed={d === day} onClick={() => setDay(d)}>{i ? s("Yesterday", "Gestern") : s("Today", "Heute")}</button>)}
    </div>
    {errText && <p role="alert">{errText}</p>}
    {data.closed && <p role="status" className="business-note">{s("Closed", "Abgeschlossen")} · {new Date(data.closed.closed_at).toLocaleString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{data.closed.closed_by_name ? ` · ${data.closed.closed_by_name}` : ""}</p>}

    {!data.closed && <Panel title={s("POS report and cash", "Kassenbericht und Bargeld")}>
      <div className="inventory-insight-coverage">
        <Field label={s("POS total sales (€)", "Kassenumsatz gesamt (€)")}><input className="form-input" inputMode="decimal" value={posTotal} onChange={(e) => setPosTotal(e.target.value)} disabled={busy} /></Field>
        <Field label={s("POS cash sales (€)", "Barumsatz laut Kasse (€)")}><input className="form-input" inputMode="decimal" value={posCash} onChange={(e) => setPosCash(e.target.value)} disabled={busy} /></Field>
        <Field label={s("Counted cash (€)", "Gezähltes Bargeld (€)")}><input className="form-input" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} disabled={busy} /></Field>
      </div>
      {data.snapshot.recorded_sales != null && <p className="t-xs u-muted">{s("Sales already recorded for this day", "Für diesen Tag erfasster Umsatz")}: {eur(data.snapshot.recorded_sales)}</p>}
    </Panel>}

    <Panel title={s("Checks", "Prüfungen")}>
      <ul className="checklist-list">{checks.map((c) => <li key={c.key} className="checklist-item day-close-row">
        <span aria-hidden="true">{c.ok ? "✅" : "⚠️"}</span>
        <div className="u-grow"><strong>{c.label}</strong> <span className={c.ok ? "u-muted" : undefined}>{c.value}</span>
          {!c.ok && !data.closed && <input className="form-input" maxLength={300} placeholder={s("Reason (required)", "Grund (erforderlich)")} aria-label={`${s("Reason", "Grund")}: ${c.label}`} value={reasons[c.key] ?? ""} onChange={(e) => setReasons({ ...reasons, [c.key]: e.target.value })} disabled={busy} />}
          {data.closed?.reasons[c.key] && <div className="t-xs u-muted">{s("Reason", "Grund")}: {data.closed.reasons[c.key]}</div>}
        </div>
        {!c.ok && !data.closed && c.link && <Link className="btn-secondary" href={c.link}>{s("Open", "Öffnen")}</Link>}
      </li>)}</ul>
    </Panel>

    {!data.closed && <>
      <Field label={s("Note (optional)", "Notiz (optional)")}><input className="form-input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></Field>
      <div className="row-actions"><button className="btn-gold" disabled={busy || missingReason} onClick={() => void submit()}>{s("Close the day", "Tag abschließen")}</button>
        {missingReason && <span className="t-xs u-muted">{s("Add a reason for every ⚠️ point.", "Für jeden ⚠️-Punkt einen Grund angeben.")}</span>}</div>
    </>}
    {data.closed?.note && <p>{data.closed.note}</p>}

    {data.recent.length > 0 && <Panel title={s("Recent closes", "Letzte Abschlüsse")}>
      <ul className="checklist-list">{data.recent.map((r) => <li key={r.work_date} className="checklist-item">
        <span className="u-grow">{fmtDay(r.work_date, locale)}</span>
        <span>{s("Cash", "Kasse")} {eur(r.cash_difference)}</span>
        <span className="t-xs u-muted">{r.open ? `${r.open} ${s("open points", "offene Punkte")}` : s("all OK", "alles OK")}</span>
      </li>)}</ul>
    </Panel>}
  </div>;
}
