"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { saveCount } from "@/lib/queries/inventory";

export default function ScanToCount({ products, onClose, onSaved }: { products: any[]; onClose: () => void; onSaved: () => void }) {
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
    const r = await saveCount(scanned.product, scanned.category, Number(count), Number(scanned.soll), scanned.unit);
    setSaving(false);
    if (r.ok) { toast(t("scan.saved", { p: scanned.product }), "success"); onSaved(); scanNext(); }
    else toast(r.error || t("scan.failed"), "error");
  }
  function scanNext() { setScanned(null); setCount(""); setErr(""); startScanner(); }
  function close() { stopScanner(); onClose(); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "***REMOVED***fff", fontWeight: 700, fontSize: 15 }}>{t("scan.title")}</span>
        <button onClick={close} style={{ color: "***REMOVED***fff", background: "none", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
      </div>

      {!scanned ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div id="scan-reader" style={{ width: "100%", maxWidth: 340, borderRadius: 12, overflow: "hidden" }} />
          {err ? (
            <>
              <div style={{ color: "***REMOVED***ec7063", marginTop: 18, textAlign: "center", fontSize: 14 }}>{err}</div>
              <button onClick={scanNext} style={{ marginTop: 14, padding: "10px 18px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "***REMOVED***fff", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>{t("scan.tryAgain")}</button>
            </>
          ) : (
            <div style={{ color: "***REMOVED***9a8f8f", marginTop: 18, textAlign: "center", fontSize: 13 }}>{t("scan.aim")}</div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, padding: 20 }}>
          <div style={{ background: "***REMOVED***1c1010", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 12, color: "***REMOVED***9a8f8f" }}>{scanned.category}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "***REMOVED***fff", marginBottom: 4 }}>{scanned.product}</div>
            <div style={{ fontSize: 12, color: "***REMOVED***9a8f8f", marginBottom: 16 }}>{t("scan.target")}: {scanned.soll} {scanned.unit || ""}</div>
            <input type="number" inputMode="decimal" autoFocus value={count} onChange={(e) => setCount(e.target.value)} placeholder={t("scan.countPh")}
              style={{ width: "100%", padding: 16, fontSize: 22, textAlign: "center", borderRadius: 12, background: "***REMOVED***241414", color: "***REMOVED***fff", border: "1px solid rgba(255,255,255,0.15)", fontWeight: 700 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: 15, borderRadius: 12, background: "***REMOVED***d4a847", color: "***REMOVED***1a1a1a", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{saving ? "…" : t("scan.saveNext")}</button>
              <button onClick={scanNext} style={{ padding: "15px 18px", borderRadius: 12, background: "transparent", color: "***REMOVED***9a8f8f", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}>{t("scan.skip")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}