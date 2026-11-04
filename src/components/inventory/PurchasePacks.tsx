"use client";
import { useRef, useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { Field } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { inventoryOperation } from "@/lib/queries/inventory-operations";
import type { Product, PurchasePack } from "@/lib/inventory/operations";

export default function PurchasePacks({ branch, product, packs, onClose, onSaved }: {
  branch: string; product: Product; packs: PurchasePack[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const { locale } = useLang();
  const s = (en: string, de: string) => locale === "de" ? de : en;
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const command = useRef<{ body: string; id: string } | null>(null);
  const close = () => { if (!busy && (!label && !quantity || window.confirm(s("Discard unsaved pack?", "Ungespeichertes Gebinde verwerfen?")))) onClose(); };
  async function save() {
    const qty = Number(quantity);
    if (busy || !reviewed || !label.trim() || !Number.isFinite(qty) || qty <= 0 || qty >= 1e9) return;
    const body = { product_id: product.id, label: label.trim(), base_qty: qty };
    const serialized = JSON.stringify(body);
    if (command.current?.body !== serialized) command.current = { body: serialized, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const result = await inventoryOperation(branch, command.current.id, "pack_save", body);
      if (!result.ok) { setError(s("Pack was not confirmed. Inputs retained; check saved packs before retrying.", "Gebinde nicht bestätigt. Eingaben bleiben erhalten; vor erneutem Versuch gespeicherte Gebinde prüfen.")); return; }
      await onSaved();
    } catch { setError(s("Pack could not be confirmed. Please check saved packs before retrying.", "Gebinde nicht bestätigt. Bitte vor erneutem Versuch gespeicherte Gebinde prüfen.")); }
    finally { setBusy(false); }
  }
  return <NativeDialog title={s("Purchase packs", "Einkaufsgebinde")} busy={busy} unsaved={!!label || !!quantity} onClose={close}>
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="inventory-fieldset">
      <h2>{product.product} · {s("Purchase packs", "Einkaufsgebinde")}</h2>
      <p>{s("Enter the stock quantity in ONE purchase pack. Example: one case of six 1-litre bottles contains 6 litres. Verify the supplier label. Existing order conversions never change.", "Bestandsmenge in EINEM Einkaufsgebinde angeben. Beispiel: Ein Karton mit sechs 1-Liter-Flaschen enthält 6 Liter. Lieferantenetikett prüfen. Umrechnungen bestehender Bestellungen bleiben unverändert.")}</p>
      <p>{s("Stock unit", "Bestandseinheit")}: <strong>{product.unit || "—"}</strong></p>
      {error && <p role="alert">{error}</p>}
      <ul>{packs.filter(pack => pack.product_id === product.id).map(pack => <li key={pack.id}>{pack.label}: {pack.base_qty} {product.unit}</li>)}</ul>
      <Field label={s("Pack name", "Gebindename")}><input className="form-input" required maxLength={80} value={label} onChange={event => { setLabel(event.target.value); setReviewed(false); }} /></Field>
      <Field label={`${s("Stock quantity per pack", "Bestandsmenge pro Gebinde")} (${product.unit || "—"})`}><input className="form-input" required type="number" min="0.000001" max="999999999" step="any" value={quantity} onChange={event => { setQuantity(event.target.value); setReviewed(false); }} /></Field>
      <label><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> {s("I verified the pack size against the supplier label.", "Ich habe die Gebindegröße anhand des Lieferantenetiketts geprüft.")}</label>
      <div className="row-actions"><button className="btn-gold" disabled={!reviewed || !product.unit}>{s("Save pack version", "Gebindeversion speichern")}</button><button className="btn-secondary" type="button" onClick={close}>{s("Cancel", "Abbrechen")}</button></div>
    </fieldset></form>
  </NativeDialog>;
}
