"use client";
import { useEffect, useRef, useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { Field } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { formatEur } from "@/lib/format";
import { getPurchaseCost, inventoryOperation } from "@/lib/queries/inventory-operations";

type Data = Extract<Awaited<ReturnType<typeof getPurchaseCost>>, { ok: true }>;
export default function InvoiceCost({ purchase, onClose }: { purchase: string; onClose: () => void }) {
  const { locale } = useLang(), s = (en: string, de: string) => locale === "de" ? de : en;
  const [data, setData] = useState<Data|null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [cost, setCost] = useState(""), [reference, setReference] = useState(""), [note, setNote] = useState(""), [reviewed, setReviewed] = useState(false);
  const command = useRef<{ key: string; id: string }|null>(null), request = useRef(0);
  async function load() {
    const seq = ++request.current; setLoading(true); setError(""); setReviewed(false);
    try { const result = await getPurchaseCost(purchase); if (seq !== request.current) return; if (result.ok) setData(result); else setError(s("Invoice cost could not be loaded.", "Rechnungskosten konnten nicht geladen werden.")); }
    catch { if (seq === request.current) setError(s("Invoice cost could not be loaded.", "Rechnungskosten konnten nicht geladen werden.")); }
    finally { if (seq === request.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, [purchase]);
  function close() { if (!busy && (!cost && !reference && !note || window.confirm(s("Discard unsaved invoice cost?", "Ungespeicherte Rechnungskosten verwerfen?")))) onClose(); }
  async function save() {
    if (!data || busy || !reviewed || cost.trim() === "") return;
    const body = { purchase_id: purchase, expected_cost: data.purchase.cost, cost: Number(cost), reference, note };
    const key = JSON.stringify(body);
    if (command.current?.key !== key) command.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const result = await inventoryOperation(data.branch, command.current.id, "purchase_cost", body);
      if (!result.ok) { setError(s("Not confirmed. The cost may have changed. Inputs retained; reload the saved cost before retrying.", "Nicht bestätigt. Kosten möglicherweise geändert. Eingaben bleiben erhalten; vor erneutem Versuch gespeicherte Kosten neu laden.")); return; }
      setCost(""); setReference(""); setNote(""); setReviewed(false); command.current = null; await load();
    } catch { setError(s("Not confirmed. Check the saved cost before retrying.", "Nicht bestätigt. Vor erneutem Versuch gespeicherte Kosten prüfen.")); }
    finally { setBusy(false); }
  }
  return <NativeDialog wide title={s("Invoice cost & history", "Rechnungskosten und Verlauf")} busy={busy} unsaved={!!cost || !!reference || !!note} onClose={close}>
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="inventory-fieldset" disabled={busy || loading}>
      <h2>{s("Invoice cost & history", "Rechnungskosten und Verlauf")}</h2>
      {loading && <p role="status">{s("Loading…", "Wird geladen…")}</p>}
      {error && <p role="alert">{error}</p>}
      {data && <><p>{data.purchase.product} · {data.purchase.supplier} · {data.purchase.qty} {data.purchase.unit}</p>
        <p>{s("Current recorded total", "Aktuell erfasste Gesamtkosten")}: <strong>{data.purchase.cost == null ? s("Unknown", "Unbekannt") : formatEur(data.purchase.cost, locale, 2)}</strong></p>

        <ul>{data.events.map(event => <li key={event.id}>{event.before_data.cost == null ? s("Unknown", "Unbekannt") : formatEur(event.before_data.cost, locale, 2)} → {formatEur(event.result.cost, locale, 2)} · {event.request.reference} · {event.request.note} · {new Date(event.recorded_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}<details><summary>{s("Audit evidence", "Prüfnachweis")}</summary>{event.actor_id} · {event.id}</details></li>)}</ul>
        <Field label={s("Received line total (€)", "Gesamtkosten der erhaltenen Position (€)")}><input className="form-input" type="number" min="0" max="999999999" step="0.01" required value={cost} onChange={event => { setCost(event.target.value); setReviewed(false); }} /></Field>
        <Field label={s("Invoice / correction reference", "Rechnungs- / Korrekturreferenz")}><input className="form-input" required maxLength={160} value={reference} onChange={event => { setReference(event.target.value); setReviewed(false); }} /></Field>
        <Field label={s("Reason / evidence", "Grund / Nachweis")}><textarea className="form-input" required minLength={3} maxLength={1000} value={note} onChange={event => { setNote(event.target.value); setReviewed(false); }} /></Field>
        <label><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> {s("I verified the total and its tax basis against the supplier document.", "Ich habe Gesamtbetrag und Steuerbasis anhand des Lieferantenbelegs geprüft.")}</label>
        <div className="row-actions"><button className="btn-gold" disabled={!reviewed}>{s("Record invoice cost", "Rechnungskosten erfassen")}</button><button className="btn-secondary" type="button" onClick={() => void load()}>{s("Reload saved cost", "Gespeicherte Kosten neu laden")}</button></div>
      </>}
      <button type="button" className="btn-secondary" onClick={close}>{s("Close", "Schließen")}</button>
    </fieldset></form>
  </NativeDialog>;
}
