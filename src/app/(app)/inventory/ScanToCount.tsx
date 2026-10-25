"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { saveCount } from "@/lib/queries/inventory";
import Icon from "@/components/Icon";
import NativeDialog from "@/components/NativeDialog";

export default function ScanToCount({ products, branchId, onClose, onSaved }: { products: any[]; branchId?: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang();
  const scannerRef = useRef<any>(null);
  const [scanned, setScanned] = useState<any>(null);
  const [count, setCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function startScanner() {
    setScanned(null); setErr("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // small delay so the target div is mounted
      await new Promise((r) => setTimeout(r, 60));
      const inst = new Html5Qrcode("scan-reader");
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text: string) => onDecode(text),
        () => {},
      );
    } catch {
      setErr(t("scan.cameraErr"));
    }
  }
  async function stopScanner() {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) { try { await inst.stop(); inst.clear(); } catch { /* already stopped */ } }
  }
  function onDecode(text: string) {
    if (!text || !text.startsWith("sq:")) return; // ignore codes that aren't ours
    const id = text.slice(3);
    const p = products.find((x) => x.id === id);
    stopScanner();
    if (!p) { setErr(t("scan.unknown")); return; }
    setScanned(p); setCount("");
  }

  useEffect(() => { startScanner(); return () => { stopScanner(); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function save() {
    if (!scanned) return;
    if (count === "") { toast(t("scan.enterCount"), "error"); return; }
    setSaving(true);
    try {
    const r = await saveCount(scanned.product, scanned.category, Number(count), Number(scanned.soll), scanned.unit, branchId);
    if (r.ok) { toast(t("scan.saved", { p: scanned.product }), "success"); onSaved(); scanNext(); }
    else toast(r.error || t("scan.failed"), "error");
    } catch { setErr(t("scan.failed")); }
    finally { setSaving(false); }
  }
  function scanNext() { setScanned(null); setCount(""); setErr(""); startScanner(); }
  function close() { stopScanner(); onClose(); }

  return (
    <NativeDialog title={t("scan.title")} busy={saving} onClose={close}>
      <div className="u-between">
        <h2>{t("scan.title")}</h2>
        <button className="ui-icon-btn" disabled={saving} type="button" aria-label={t("common.close")} onClick={close}><Icon e="✕" size={20} /></button>
      </div>

      {!scanned ? (
        <div className="inventory-scanner">
          <label>{t("inventoryOps.manualProduct")}<select className="form-select" value="" onChange={e=>{const p=products.find(p=>p.id===e.target.value);if(p){stopScanner();setScanned(p);setCount("");}}}><option value="">—</option>{products.map(p=><option key={p.id} value={p.id}>{p.product} · {p.unit||"—"}</option>)}</select></label>
          <div id="scan-reader" className="inventory-scanner-reader" />
          {err ? (
            <>
              <div role="alert" className="tone-danger">{err}</div>
              <button className="btn-secondary" onClick={scanNext}>{t("scan.tryAgain")}</button>
            </>
          ) : (
            <p className="muted">{t("scan.aim")}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="card">
            <p className="muted">{scanned.category}</p>
            <h3>{scanned.product}</h3>
            <p className="muted">{t("scan.target")}: {scanned.soll} {scanned.unit || ""}</p>
            {err&&<p role="alert" className="tone-danger">{err}</p>}
            <input className="form-input ui-big-input" aria-label={t("scan.countPh")} type="number" min="0" step="any" inputMode="decimal" autoFocus value={count} onChange={(e) => setCount(e.target.value)} placeholder={t("scan.countPh")} />
            <div className="row-actions">
              <button className="btn-gold" onClick={save} disabled={saving}>{saving ? "…" : t("scan.saveNext")}</button>
              <button className="btn-secondary" disabled={saving} onClick={scanNext}>{t("scan.skip")}</button>
            </div>
          </div>
        </div>
      )}
    </NativeDialog>
  );
}
