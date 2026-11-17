"use client";
// Clock in / out from Home: one tap opens this popup, the employee picks the kiosk's QR or its 6-digit code.
// Same server rules as the Attendance page (useClock.byCode / byQR); offline it is saved to sync later.
import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import NativeDialog from "@/components/NativeDialog";
import QrScanner from "@/app/(app)/attendance/QrScanner";
import type { useClock } from "@/components/attendance/useClock";

export default function ClockPick({ mode, clock, onClose }: { mode: "in" | "out"; clock: ReturnType<typeof useClock>; onClose: () => void }) {
  const { t, locale } = useLang();
  const [step, setStep] = useState<"choose" | "code" | "scan">("choose");
  const [code, setCode] = useState(""), [err, setErr] = useState<string | null>(null);
  const de = locale === "de";
  const title = mode === "out" ? (de ? "Ausstempeln" : "Clock out") : (de ? "Einstempeln" : "Clock in");

  if (step === "scan") return <QrScanner onScan={(payload) => { onClose(); void clock.byQR(mode, payload); }} onClose={() => setStep("choose")} />;

  async function submit() {
    setErr(null);
    const e = await clock.byCode(mode, code);
    if (e) setErr(e); else onClose();
  }
  return (
    <NativeDialog title={title} busy={clock.working} onClose={onClose}>
      {step === "choose" ? (
        <div className="clock-pick">
          <button type="button" className="clock-alt" onClick={() => setStep("scan")}>{de ? "QR-Code scannen" : "Scan QR code"}</button>
          <button type="button" className="clock-alt" onClick={() => setStep("code")}>{de ? "Code eingeben" : "Enter code"}</button>
          <button type="button" className="btn-secondary btn-block" onClick={onClose}>{t("common.cancel")}</button>
        </div>
      ) : (
        <>
          <div className="t-xs u-muted mb-4">{t("att.codeHint")}</div>
          <input autoFocus aria-label={t("att.codeHint")} value={code} placeholder="000000" inputMode="numeric" className="clock-code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          {err && <div role="alert" className="tone-danger t-xs mt-3 u-center">{err}</div>}
          <div className="d-flex gap-2 mt-4">
            <button type="button" disabled={clock.working} onClick={() => { setStep("choose"); setErr(null); }} className="clock-alt">{t("common.back")}</button>
            <button type="button" onClick={() => void submit()} disabled={clock.working || code.length !== 6} className={`clock-btn ${mode === "out" ? "out" : "in"} u-flex1`}>{clock.working ? "…" : t("att.confirm")}</button>
          </div>
        </>
      )}
    </NativeDialog>
  );
}
