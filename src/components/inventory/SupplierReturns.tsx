"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NativeDialog from "@/components/NativeDialog";
import { Field, Panel } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { formatEur } from "@/lib/format";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { getSupplierReturns, inventoryOperation } from "@/lib/queries/inventory-operations";
import type { SupplierReturn } from "@/lib/queries/inventory-operations";

type Data = Extract<Awaited<ReturnType<typeof getSupplierReturns>>, { ok: true }>;
type Form = { kind: "return"; batch: string } | { kind: "credit"; returned: SupplierReturn };
export default function SupplierReturns() {
  const { locale } = useLang();
  const s = (en: string, de: string) => locale === "de" ? de : en;
  const [data, setData] = useState<Data|null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [form, setForm] = useState<Form|null>(null);
  const [qty, setQty] = useState(""), [reference, setReference] = useState(""), [note, setNote] = useState(""), [date, setDate] = useState(berlinToday);
  const [basis, setBasis] = useState(""), [reviewed, setReviewed] = useState(false);
  const request = useRef(0), command = useRef<{ body: string; id: string }|null>(null);
  async function load() {
    const seq = ++request.current; setLoading(true); setError("");
    try { const result = await getSupplierReturns(); if (seq !== request.current) return; if (result.ok) setData(result); else setError(s("Returns could not be loaded. Check branch access and retry.", "Retouren konnten nicht geladen werden. Filialzugriff prüfen und erneut versuchen.")); }
    catch { if (seq === request.current) setError(s("Returns could not be loaded.", "Retouren konnten nicht geladen werden.")); }
    finally { if (seq === request.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, []);
  function open(next: Form) { setForm(next); setQty(""); setReference(""); setNote(""); setDate(berlinToday()); setBasis(""); setReviewed(false); setError(""); }
  function close() { if (!busy && window.confirm(s("Discard unsaved return or credit?", "Ungespeicherte Retoure oder Gutschrift verwerfen?"))) { setForm(null); setError(""); } }
  async function save() {
    if (!data || !form || busy || !reviewed) return;
    const action = form.kind === "return" ? "supplier_return" : "supplier_credit";
    const body = form.kind === "return" ? { batch_id: form.batch, qty: Number(qty), reference, date, note } : { return_id: form.returned.id, amount: Number(qty), tax_basis: basis, reference, date, note };
    const key = JSON.stringify({ action, body });
    if (command.current?.body !== key) command.current = { body: key, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const result = await inventoryOperation(data.branch, command.current.id, action, body);
      if (!result.ok) { setError(s("Not confirmed. Check remaining stock, dates and duplicate references. Inputs retained; review saved records before retrying.", "Nicht bestätigt. Restbestand, Daten und doppelte Referenzen prüfen. Eingaben bleiben erhalten; vor erneutem Versuch gespeicherte Belege prüfen.")); return; }
      command.current = null; setForm(null); await load();
    } catch { setError(s("Not confirmed. Check saved records before retrying.", "Nicht bestätigt. Vor erneutem Versuch gespeicherte Belege prüfen.")); }
    finally { setBusy(false); }
  }
  const selected = form?.kind === "return" ? data?.batches.find(batch => batch.id === form.batch) : null;
  return <Panel title={s("Supplier returns & credits", "Lieferantenretouren und Gutschriften")}>

    <button className="btn-gold" disabled={loading || !data || busy} onClick={() => open({ kind: "return", batch: "" })}>{s("Record goods sent back", "Zurückgesendete Ware erfassen")}</button>
    {error && !form && <p role="alert">{error} <button className="btn-secondary" onClick={() => void load()}>{s("Retry", "Erneut versuchen")}</button></p>}
    {loading ? <p role="status">{s("Loading…", "Wird geladen…")}</p> : data && <>
      {!data.returns.length && <p>{s("No supplier returns recorded.", "Keine Lieferantenretouren erfasst.")}</p>}
      {data.returns.map(returned => {
        const credits = data.credits.filter(credit => credit.return_id === returned.id);
        return <details className="inventory-receipt" key={returned.id}><summary>{returned.reference} · {returned.product} · {returned.qty} {returned.unit} · {fmtDay(returned.return_date, locale)}</summary>
          <p>{returned.supplier} · {returned.reason}</p>
          <Link className="btn-secondary" href={`/expiry?search=${encodeURIComponent(returned.product)}`}>{s("Inspect batches", "Chargen prüfen")}</Link>
          <p>{s("Credit evidence", "Gutschriftsnachweise")}: {credits.length || s("Not recorded", "Nicht erfasst")}</p>
          <ul>{credits.map(credit => <li key={credit.id}>{credit.reference} · {fmtDay(credit.credit_date, locale)} · {formatEur(credit.amount, locale, 2)} · {credit.tax_basis === "net" ? s("Net", "Netto") : credit.tax_basis === "gross" ? s("Gross", "Brutto") : s("Tax basis unconfirmed", "Steuerbasis unbestätigt")} · {credit.note}</li>)}</ul>

          <button className="btn-secondary" disabled={busy} onClick={() => open({ kind: "credit", returned })}>{s("Record supplier credit", "Lieferantengutschrift erfassen")}</button>
        </details>;
      })}
    </>}
    {form && data && <NativeDialog wide unsaved title={form.kind === "return" ? s("Record goods sent back", "Zurückgesendete Ware erfassen") : s("Record supplier credit", "Lieferantengutschrift erfassen")} busy={busy} onClose={close}>
      <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="inventory-fieldset">
        <h2>{form.kind === "return" ? s("Goods actually sent back", "Tatsächlich zurückgesendete Ware") : s("Supplier credit document", "Gutschriftsbeleg des Lieferanten")}</h2>
        {error && <p role="alert">{error}</p>}
        {form.kind === "return" ? <Field label={s("Receipt-linked batch", "Wareneingangscharge")}><select className="form-select" aria-label={s("Receipt-linked batch","Wareneingangscharge")} required value={form.batch} onChange={event => { setForm({ kind: "return", batch: event.target.value }); setReviewed(false); }}><option value="">{s("Choose batch", "Charge wählen")}</option>{data.batches.map(batch => <option key={batch.id} value={batch.id}>{batch.product} · {batch.receipt_reference} · {batch.remaining_qty} {batch.unit} · {batch.purchase?.supplier || "—"}</option>)}</select></Field> : <p>{form.returned.supplier} · {form.returned.reference} · {form.returned.product}</p>}
        <Field label={form.kind === "return" ? `${s("Quantity sent back", "Zurückgesendete Menge")} (${selected?.unit || "—"})` : s("Credit amount (€)", "Gutschriftsbetrag (€)")}><input className="form-input" required type="number" min={form.kind === "return" ? "0.000001" : "0.01"} max={form.kind === "return" ? selected?.remaining_qty : "999999999"} step={form.kind === "return" ? "any" : "0.01"} value={qty} onChange={event => { setQty(event.target.value); setReviewed(false); }} /></Field>
        <Field label={s("Document reference", "Belegreferenz")}><input className="form-input" required maxLength={160} value={reference} onChange={event => { setReference(event.target.value); setReviewed(false); }} /></Field>
        <Field label={s("Document / return date", "Beleg- / Retourendatum")}><input className="form-input" type="date" required min={form.kind === "return" ? selected?.received_date : form.returned.return_date} max={berlinToday()} value={date} onChange={event => { setDate(event.target.value); setReviewed(false); }} /></Field>
        {form.kind === "credit" && <Field label={s("Tax basis on credit document", "Steuerbasis des Gutschriftsbelegs")}><select className="form-select" aria-label={s("Tax basis on credit document","Steuerbasis des Gutschriftsbelegs")} required value={basis} onChange={event => { setBasis(event.target.value); setReviewed(false); }}><option value="">—</option><option value="net">{s("Net", "Netto")}</option><option value="gross">{s("Gross", "Brutto")}</option><option value="unconfirmed">{s("Unconfirmed", "Unbestätigt")}</option></select></Field>}
        <Field label={s("Reason / evidence", "Grund / Nachweis")}><textarea className="form-input" required minLength={3} maxLength={1000} value={note} onChange={event => { setNote(event.target.value); setReviewed(false); }} /></Field>
        <label><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> {form.kind === "return" ? s("I checked the batch and quantity actually sent back. This does not record a credit.", "Ich habe Charge und tatsächlich zurückgesendete Menge geprüft. Dies erfasst keine Gutschrift.") : s("I checked the supplier credit document. This does not change stock or confirm payment.", "Ich habe den Lieferantengutschriftsbeleg geprüft. Dies ändert keinen Bestand und bestätigt keine Zahlung.")}</label>
        <div className="row-actions"><button className="btn-gold" disabled={!reviewed}>{s("Save", "Speichern")}</button><button className="btn-secondary" type="button" onClick={close}>{s("Cancel", "Abbrechen")}</button></div>
      </fieldset></form>
    </NativeDialog>}
  </Panel>;
}
