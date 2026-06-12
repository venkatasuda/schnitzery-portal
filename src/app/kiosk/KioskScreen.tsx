"use client";

import { useEffect, useState, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getCurrentClockCode } from "@/lib/queries/clockcode";

// In-store KIOSK display. Left running on a shared tablet pinned to this screen.
// Shows the branch's rotating QR + 6-digit code; staff clock in/out on their own
// phones using it. The signed-in kiosk account can read nothing but its branch code.
export default function KioskScreen() {
  const { t } = useLang();
  const [code, setCode] = useState("------");
  const [qrPayload, setQrPayload] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [rotateSeconds, setRotateSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchCode() {
    const res = await getCurrentClockCode();
    if (res.ok) {
      setCode(res.code ?? "------");
      setQrPayload(res.qrPayload ?? "");
      setSecondsLeft(res.secondsLeft ?? 30);
      setRotateSeconds(res.rotateSeconds ?? 30);
      setError(null);
    } else {
      setError(res.error || t("cd.couldNotLoad"));
    }
  }

  useEffect(() => {
    fetchCode();
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          fetchCode();
          return rotateSeconds;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((secondsLeft / rotateSeconds) * 100);
  const qrImg = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=${encodeURIComponent(qrPayload)}`
    : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 0%, #2a1414, #160c0c 70%)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        userSelect: "none",
      }}
    >
      <div style={{ color: "#d4a847", fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", letterSpacing: 0.5 }}>
        Schnitzery
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 2px", fontFamily: "Georgia, serif" }}>
        {t("kiosk.title")}
      </h1>
      <p style={{ color: "#b8a9a9", fontSize: 15, margin: "0 0 28px", maxWidth: 460, lineHeight: 1.4 }}>
        {t("kiosk.hint")}
      </p>

      {error ? (
        <div style={{ color: "#ec7063", fontSize: 18, padding: 40 }}>{error}</div>
      ) : (
        <>
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 16,
              boxShadow: "0 12px 50px rgba(0,0,0,0.5)",
              marginBottom: 28,
            }}
          >
            {qrImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImg} alt="Clock QR" style={{ width: 300, height: 300, display: "block" }} />
            ) : (
              <div style={{ width: 300, height: 300, background: "#eee", borderRadius: 12 }} />
            )}
          </div>

          <div style={{ fontSize: 14, letterSpacing: 3, color: "#9a8f8f", marginBottom: 8 }}>
            {t("cd.orEnterCode")}
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: 14,
              color: "#d4a847",
              fontFamily: "Georgia, serif",
              lineHeight: 1,
            }}
          >
            {code}
          </div>

          <div style={{ width: 320, maxWidth: "80vw", marginTop: 28 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#d4a847", transition: "width 1s linear" }} />
            </div>
            <div style={{ fontSize: 13, color: "#9a8f8f", marginTop: 10 }}>
              {t("cd.newCodeIn", { n: secondsLeft })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}