"use client";
// End-of-day close (shift leaders + managers): POS report, counted cash, and the day's checks.
// Open points need a short reason; once closed, the day is read-only.
import { askConfirm } from "@/components/ConfirmDialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, Panel, Field, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { formatEur } from "@/lib/format";
import { addDays } from "@/lib/inventory/prep-list";
import { getDayClose, closeDay, type DaySnapshot } from "@/lib/queries/day-close";
import { CHANNELS, CHANNEL_LABEL, channelTotal, type Channel, type ChannelSales } from "@/lib/sales/channels";

type Data = Extract<Awaited<ReturnType<typeof getDayClose>>, { ok: true }>;
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
type ChanForm = Record<Channel, { gross: string; orders: string }>;
const emptyChan = (): ChanForm => ({ lieferando: { gross: "", orders: "" }, uber_eats: { gross: "", orders: "" }, wolt: { gross: "", orders: "" } });
// Platforms with a total entered; orders left empty count as 0. Null when a figure cannot be read.
function toChannels(f: ChanForm): ChannelSales | null {
  const out: ChannelSales = {};
  for (const k of CHANNELS) {
    const g = num(f[k].gross), o = num(f[k].orders);
    if (g == null) { if (o != null) return null; continue; }
    if (!Number.isFinite(g) || g < 0 || (o != null && (!Number.isInteger(o) || o < 0))) return null;
    out[k] = { gross: Math.round(g * 100) / 100, orders: o ?? 0 };
  }
  return out;
}

export default function DayClosePage() {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const eur = (v: number | null) => (v == null ? "—" : formatEur(v, locale, 2));
  const [day, setDay] = useState(berlinToday());
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [posTotal, setPosTotal] = useState(""), [posCash, setPosCash] = useState(""), [counted, setCounted] = useState(""), [note, setNote] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [chan, setChan] = useState<ChanForm>(emptyChan);

  async function load(d: string) {
    setError("");
    try { const r = await getDayClose(d); if (r.ok) setData(r); else { setData(null); setError(r.error); } } catch { setError("load"); }
  }
  useEffect(() => { void load(day); setReasons({}); setPosTotal(""); setPosCash(""); setCounted(""); setNote(""); setChan(emptyChan()); }, [day]);

  if (error === "access") return <ErrorState message={s("The day close is for shift leaders and managers.", "Der Tagesabschluss ist für Schichtleitung und Leitung.")} />;
  if (!data) return error ? <ErrorState message={s("Day close could not be loaded.", "Tagesabschluss konnte nicht geladen werden.")} onRetry={() => load(day)} retryLabel={s("Retry", "Erneut versuchen")} /> : <CardSkeleton rows={6} />;

  const snap: DaySnapshot = data.closed?.snapshot ?? data.snapshot;
  const channels = toChannels(chan), delivery = channelTotal(channels);
  // Till + delivery platforms = the day's sales (what daily_sales and every dashboard use).
  const total = num(posTotal) != null && channels ? Math.round((num(posTotal)! + delivery) * 100) / 100 : null;
  const closedTotal = data.closed?.pos_total != null ? Math.round((data.closed.pos_total + channelTotal(data.closed.channels)) * 100) / 100 : null;
  const diff = num(counted) != null && num(posCash) != null ? Math.round((num(counted)! - num(posCash)!) * 100) / 100 : null;
  const checks: { key: string; ok: boolean; label: string; value: string; link?: string }[] = [
    // Same rule as private.close_day: entered, and equal to any figure already in daily_sales.
    { key: "sales", ok: data.closed ? !(data.closed.snapshot.open_points ?? []).includes("sales") : total != null && (snap.recorded_sales == null || Math.abs(total - Number(snap.recorded_sales)) < 0.01),
      label: s("Sales (till + delivery)", "Umsatz (Kasse + Lieferdienste)"), value: eur(data.closed ? closedTotal : total) },
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
    if (!channels) { setError("channels"); return; }
    if (!(await askConfirm({ message: s("Close this day? It cannot be changed afterwards.", "Diesen Tag abschließen? Danach ist keine Änderung mehr möglich.") }))) return;
    setBusy(true); setError("");
    try {
      const r = await closeDay(data.branch.id, day, num(posTotal), num(posCash), num(counted), reasons, note, channels);
      if (!r.ok) { setError(r.error === "reason" ? `reason:${r.missing}` : r.error); return; }
      await load(day);
    } catch { setError("save"); } finally { setBusy(false); }
  }
  const errText = error.startsWith("reason:") ? s("A reason is missing for an open point.", "Für einen offenen Punkt fehlt ein Grund.")
    : error === "closed" ? s("This day was already closed by someone else. Reloaded.", "Dieser Tag wurde bereits abgeschlossen. Neu geladen.")
    : error === "cash" ? s("POS cash cannot be higher than POS total.", "Bar laut Kasse kann nicht höher als der Gesamtumsatz sein.")
    : error === "channels" ? s("Check the delivery figures: totals in €, orders as whole numbers.", "Lieferdienst-Zahlen prüfen: Umsatz in €, Bestellungen als ganze Zahl.")
    : error ? s("Not closed. Check the numbers and retry.", "Nicht abgeschlossen. Zahlen prüfen und erneut versuchen.") : "";

  return <div className="page-narrow">
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

    {!data.closed && <Panel title={s("Delivery platforms (own printers, not in the till)", "Lieferdienste (eigene Drucker, nicht in der Kasse)")}>
      <div className="table-scroll"><table className="data-table day-close-channels">
        <thead><tr><th scope="col">{s("Platform", "Plattform")}</th><th scope="col">{s("Sales today (€)", "Umsatz heute (€)")}</th><th scope="col">{s("Orders", "Bestellungen")}</th></tr></thead>
        <tbody>{CHANNELS.map((k) => <tr key={k}><th scope="row">{CHANNEL_LABEL[k]}</th>
          <td><input className="form-input" inputMode="decimal" aria-label={`${CHANNEL_LABEL[k]} ${s("sales (€)", "Umsatz (€)")}`} value={chan[k].gross} onChange={(e) => setChan({ ...chan, [k]: { ...chan[k], gross: e.target.value } })} disabled={busy} /></td>
          <td><input className="form-input" inputMode="numeric" aria-label={`${CHANNEL_LABEL[k]} ${s("orders", "Bestellungen")}`} value={chan[k].orders} onChange={(e) => setChan({ ...chan, [k]: { ...chan[k], orders: e.target.value } })} disabled={busy} /></td></tr>)}</tbody>
      </table></div>
      <p className="t-xs u-muted">{s("From each tablet's daily summary. Leave empty if the platform had no orders.", "Aus der Tagesübersicht des jeweiligen Tablets. Leer lassen, wenn es keine Bestellungen gab.")}
        {total != null && ` ${s("Day total", "Tagesumsatz")}: ${eur(total)} (${s("till", "Kasse")} ${eur(num(posTotal))} + ${s("delivery", "Lieferdienste")} ${eur(delivery)})`}</p>
    </Panel>}

    {data.closed && channelTotal(data.closed.channels) > 0 && <Panel title={s("Delivery platforms", "Lieferdienste")}>
      <ul className="checklist-list">{CHANNELS.filter((k) => data.closed!.channels[k]).map((k) => <li key={k} className="checklist-item">
        <span className="u-grow">{CHANNEL_LABEL[k]}</span><span>{eur(data.closed!.channels[k]!.gross)}</span>
        <span className="t-xs u-muted">{data.closed!.channels[k]!.orders} {s("orders", "Bestellungen")}</span></li>)}</ul>
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
        <span className="t-xs">{r.till == null ? "—" : eur(Math.round((r.till + r.delivery) * 100) / 100)}{r.delivery > 0 ? ` · ${s("delivery", "Lieferdienste")} ${eur(r.delivery)}` : ""}</span>
        <span>{s("Cash", "Kasse")} {eur(r.cash_difference)}</span>
        <span className="t-xs u-muted">{r.open ? `${r.open} ${s("open points", "offene Punkte")}` : s("all OK", "alles OK")}</span>
      </li>)}</ul>
    </Panel>}
  </div>;
}
