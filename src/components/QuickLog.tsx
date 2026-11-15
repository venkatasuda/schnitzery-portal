"use client";
// One-tap floor logging from Home (AI Studio review): fridge temperatures and waste in a dialog, without leaving
// the page. Same server actions and rules as /temp and /waste (out-of-range needs a corrective action; waste needs
// a catalogue product and a quantity > 0). Not optimistic: the dialog waits for the server and shows its answer.
import { useEffect, useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { getTempUnits, logTemp } from "@/lib/queries/temp";
import { getWasteProducts, logWaste } from "@/lib/queries/waste";

type Unit = { id: string; name: string; min_temp: number; max_temp: number; opening: boolean; closing: boolean };
type Product = { product: string; category: string | null; unit: string | null };
const REASONS = ["spoiled", "dropped", "overcooked", "expired", "other"] as const;

export default function QuickLog() {
  const { t, locale } = useLang();
  const de = locale === "de";
  const [open, setOpen] = useState<null | "temp" | "waste">(null);
  return (
    <>
      <div className="quick-log" role="group" aria-label={de ? "Schnell erfassen" : "Quick log"}>
        <button type="button" className="btn-secondary" onClick={() => setOpen("temp")}>🌡️ {t("home.tempLog")}</button>
        <button type="button" className="btn-secondary" onClick={() => setOpen("waste")}>🗑️ {t("home.wasteLog")}</button>
      </div>
      {open === "temp" && <TempDialog onClose={() => setOpen(null)} />}
      {open === "waste" && <WasteDialog onClose={() => setOpen(null)} />}
    </>
  );
}

function TempDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLang();
  const de = locale === "de";
  const [units, setUnits] = useState<Unit[] | null>(null), [closingNow, setClosingNow] = useState(false), [failed, setFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({}), [fix, setFix] = useState<Record<string, string>>({});
  const [needsFix, setNeedsFix] = useState<Record<string, boolean>>({}), [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    getTempUnits().then((r) => { if (r.ok) { setUnits(r.units as Unit[]); setClosingNow(!!r.closingNow); } else setFailed(true); }, () => setFailed(true));
  }, []);
  async function save(u: Unit) {
    const v = Number((values[u.id] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || (values[u.id] ?? "").trim() === "") return;
    setBusy(u.id);
    try {
      const r = await logTemp(u.id, v, "", fix[u.id] ?? "");
      if (r.ok) {
        toast(de ? `${u.name}: gespeichert` : `${u.name}: saved`, r.inRange ? "success" : "info");
        setUnits((list) => list?.map((x) => x.id === u.id ? { ...x, [closingNow ? "closing" : "opening"]: true } : x) ?? null);
        setValues((s) => ({ ...s, [u.id]: "" })); setNeedsFix((s) => ({ ...s, [u.id]: false }));
      } else if ("needsAction" in r && r.needsAction) setNeedsFix((s) => ({ ...s, [u.id]: true }));
      else toast(r.error || t("temp.failed"), "error");
    } catch { toast(t("temp.failed"), "error"); }
    finally { setBusy(null); }
  }
  return (
    <NativeDialog title={t("home.tempLog")} busy={busy != null} onClose={onClose}>
      {failed ? <p role="alert">{de ? "Kühlgeräte konnten nicht geladen werden." : "Fridges could not be loaded."}</p>
        : units == null ? <Skeleton height={120} />
        : !units.length ? <p className="ui-muted">{de ? "Noch keine Kühlgeräte eingerichtet." : "No fridges set up yet."}</p>
        : <ul className="quick-temp">{units.map((u) => {
          const done = closingNow ? u.closing : u.opening;
          return <li key={u.id}>
            <div><strong>{u.name}</strong><span className="ui-muted inv-mono">{u.min_temp}–{u.max_temp} °C{done ? ` · ✓ ${closingNow ? (de ? "Abend" : "closing") : (de ? "Morgen" : "opening")}` : ""}</span></div>
            <div className="quick-temp-input">
              <input className="form-input" type="text" inputMode="decimal" aria-label={`${u.name} °C`} placeholder="°C" value={values[u.id] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [u.id]: e.target.value }))} />
              <button type="button" className="btn-gold ui-btn-sm" disabled={busy != null || !(values[u.id] ?? "").trim()} aria-busy={busy === u.id} onClick={() => void save(u)}>{de ? "Speichern" : "Save"}</button>
            </div>
            {needsFix[u.id] && <input className="form-input quick-temp-fix" autoFocus aria-label={de ? "Korrekturmaßnahme" : "Corrective action"} placeholder={de ? "Außerhalb des Bereichs: was wurde getan?" : "Out of range: what was done?"} value={fix[u.id] ?? ""} onChange={(e) => setFix((s) => ({ ...s, [u.id]: e.target.value }))} />}
          </li>;
        })}</ul>}
    </NativeDialog>
  );
}

function WasteDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLang();
  const de = locale === "de";
  const [products, setProducts] = useState<Product[] | null>(null), [failed, setFailed] = useState(false);
  const [pick, setPick] = useState(""), [qty, setQty] = useState(""), [reason, setReason] = useState<(typeof REASONS)[number]>("spoiled"), [busy, setBusy] = useState(false);
  useEffect(() => {
    getWasteProducts().then((r) => { if (r.ok) setProducts(r.products as Product[]); else setFailed(true); }, () => setFailed(true));
  }, []);
  const product = products?.find((p) => `${p.category}|${p.product}|${p.unit}` === pick);
  const amount = Number(qty.replace(",", "."));
  async function save() {
    if (!product || !(amount > 0)) return;
    setBusy(true);
    try {
      const r = await logWaste(product.product, product.category ?? "", amount, product.unit ?? "", reason, "");
      if (r.ok) { toast(t("waste.logged"), "success"); onClose(); } else toast(r.error || t("waste.failed"), "error");
    } catch { toast(t("waste.failed"), "error"); }
    finally { setBusy(false); }
  }
  return (
    <NativeDialog title={t("home.wasteLog")} busy={busy} onClose={onClose}>
      {failed ? <p role="alert">{de ? "Produkte konnten nicht geladen werden." : "Products could not be loaded."}</p> : products == null ? <Skeleton height={120} /> : <div className="quick-waste">
        <label className="ui-field"><span className="ui-field-label">{de ? "Produkt" : "Product"}</span>
          <select className="form-select" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">{de ? "Produkt wählen" : "Choose product"}</option>
            {products.map((p) => <option key={`${p.category}|${p.product}|${p.unit}`} value={`${p.category}|${p.product}|${p.unit}`}>{p.product}{p.unit ? ` (${p.unit})` : ""}</option>)}</select></label>
        <label className="ui-field"><span className="ui-field-label">{de ? "Menge" : "Quantity"}{product?.unit ? ` (${product.unit})` : ""}</span>
          <input className="form-input" type="text" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <div className="ui-chips" role="group" aria-label={t("waste.logWaste")}>
          {REASONS.map((r) => <button key={r} type="button" className="ui-choice" aria-pressed={reason === r} onClick={() => setReason(r)}>{t("waste.r_" + r)}</button>)}
        </div>
        <button type="button" className="btn-gold" disabled={busy || !product || !(amount > 0)} aria-busy={busy} onClick={() => void save()}>{t("waste.logWaste")}</button>
      </div>}
    </NativeDialog>
  );
}
