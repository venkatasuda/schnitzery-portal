"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getClockCodeBatch } from "@/lib/queries/clockcode";

const LS_KEY = "sz_kiosk_codebatch";
const REFILL_BELOW = 60;   // refill when fewer than 60 windows (30 min) remain
type Batch = { startWindow: number; codes: { w: number; code: string }[]; branchId: string; rotateSeconds: number };

// In-store kiosk display with EMERGENCY ATTENDANCE MODE:
// while online it pre-caches a rolling 2-hour window of upcoming codes, so if the
// connection (or Supabase, or the server) drops, it keeps showing genuinely-valid
// codes from the cache — the secret never lives on the device. Staff phones scan
// them and the server validates on sync. A banner makes the mode visible.
export default function KioskScreen() {
  const { t } = useLang();
  const [code, setCode] = useState("------");
  const [qrPayload, setQrPayload] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [emergency, setEmergency] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const batchRef = useRef<Batch | null>(null);
  const fetchingRef = useRef(false);

  function saveBatch(b: Batch) {
    batchRef.current = b;
    try { localStorage.setItem(LS_KEY, JSON.stringify(b)); } catch {}
  }
  function loadCachedBatch() {
    try { const r = localStorage.getItem(LS_KEY); if (r) batchRef.current = JSON.parse(r); } catch {}
  }

  async function refreshBatch() {
    if (fetchingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setEmergency(true); return; }
    fetchingRef.current = true;
    const res = await getClockCodeBatch(240);
    fetchingRef.current = false;
    if (res.ok && res.codes?.length) {
      saveBatch({ startWindow: res.startWindow, codes: res.codes, branchId: res.branchId, rotateSeconds: res.rotateSeconds });
      setEmergency(false);
    } else {
      setEmergency(true); // internet / Supabase / server unavailable — fall back to cache
    }
  }

  function tick() {
    const nowSec = Math.floor(Date.now() / 1000);
    const w = Math.floor(nowSec / 30);
    setSecondsLeft(30 - (nowSec % 30));
    const b = batchRef.current;
    if (!b) { setCode("------"); setQrPayload(""); return; }
    const idx = w - b.startWindow;
    if (idx >= 0 && idx < b.codes.length) {
      const c = b.codes[idx].code;
      setCode(c);
      setQrPayload(`SCHNITZERY-CLOCK:${b.branchId}:${c}`);
      setExhausted(false);
      if (b.codes.length - idx < REFILL_BELOW && navigator.onLine) refreshBatch();
    } else {
      // before the cache (clock skew) or past the end of it
      setExhausted(idx >= b.codes.length);
      if (navigator.onLine) refreshBatch();
    }
  }

  useEffect(() => {
    loadCachedBatch();
    refreshBatch();
    tick();
    const iv = setInterval(tick, 1000);
    const refreshIv = setInterval(() => { if (navigator.onLine) refreshBatch(); }, 5 * 60 * 1000);
    const onOnline = () => refreshBatch();
    const onOffline = () => setEmergency(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(iv); clearInterval(refreshIv);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((secondsLeft / 30) * 100);
  const qrImg = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=${encodeURIComponent(qrPayload)}`
    : "";
  const codeUsable = !!qrPayload && !exhausted;

  return (
    <div style={{
      minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #2a1414, #160c0c 70%)",
      color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "24px", fontFamily: "system-ui, sans-serif", userSelect: "none",
    }}>
      {/* Emergency / exhausted banner */}
      {(emergency || exhausted) && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, padding: "10px 16px",
          background: exhausted ? "#922b21" : "#b9770e", color: "#fff", fontSize: 14, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 10,
        }}>
          <span style={{ fontSize: 16 }}>{exhausted ? "⛔" : "⚠️"}</span>
          {exhausted ? t("kiosk.exhausted") : `${t("kiosk.emergency")} — ${t("kiosk.emergencyHint")}`}
        </div>
      )}

      <div style={{ color: "#d4a847", fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", letterSpacing: 0.5 }}>Schnitzery</div>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 2px", fontFamily: "Georgia, serif" }}>{t("kiosk.title")}</h1>
      <p style={{ color: "#b8a9a9", fontSize: 15, margin: "0 0 28px", maxWidth: 460, lineHeight: 1.4 }}>{t("kiosk.hint")}</p>

      {!codeUsable ? (
        <div style={{ color: "#ec7063", fontSize: 18, padding: 40, maxWidth: 420 }}>{t("kiosk.exhausted")}</div>
      ) : (
        <>
          <div style={{ background: "#fff", borderRadius: 24, padding: 16, boxShadow: "0 12px 50px rgba(0,0,0,0.5)", marginBottom: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImg} alt="Clock QR" style={{ width: 300, height: 300, display: "block" }} />
          </div>

          <div style={{ fontSize: 14, letterSpacing: 3, color: "#9a8f8f", marginBottom: 8 }}>{t("cd.orEnterCode")}</div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: 14, color: "#d4a847", fontFamily: "Georgia, serif", lineHeight: 1 }}>{code}</div>

          <div style={{ width: 320, maxWidth: "80vw", marginTop: 28 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: emergency ? "#e8a35a" : "#d4a847", transition: "width 1s linear" }} />
            </div>
            <div style={{ fontSize: 13, color: "#9a8f8f", marginTop: 10 }}>{t("cd.newCodeIn", { n: secondsLeft })}</div>
          </div>
        </>
      )}
    </div>
  );
}