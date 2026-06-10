"use client";

import { useEffect, useState, useRef } from "react";
import { getCurrentClockCode } from "@/lib/queries/clockcode";

// MANAGER DISPLAY — show this on a tablet/screen at the restaurant.
// Staff scan the QR or type the 6-digit code to clock in/out.
export default function ClockDisplayPage() {
  const [code, setCode] = useState("------");
  const [qrPayload, setQrPayload] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [rotateSeconds, setRotateSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<any>(null);

  async function fetchCode() {
    const res = await getCurrentClockCode();
    if (res.ok) {
      setCode(res.code ?? "------");
      setQrPayload(res.qrPayload ?? "");
      setSecondsLeft(res.secondsLeft ?? 30);
      setRotateSeconds(res.rotateSeconds ?? 30);
      setError(null);
    } else {
      setError(res.error || "Could not load code.");
    }
  }

  useEffect(() => {
    fetchCode();
    // Local countdown; refetch when it hits zero (new window).
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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(qrPayload)}`
    : "";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 4 }}>
        📲 Clock-In Display
      </h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 24 }}>
        Staff: scan this QR or enter the code in your app.
      </p>

      <div style={{ background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32 }}>
        {error ? (
          <div style={{ color: "#ec7063", padding: 30 }}>{error}</div>
        ) : (
          <>
            {/* QR */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              {qrImg ? (
                <img src={qrImg} alt="Clock QR" style={{ width: 260, height: 260, borderRadius: 16, background: "#fff", padding: 8 }} />
              ) : (
                <div style={{ width: 260, height: 260, borderRadius: 16, background: "rgba(255,255,255,0.05)" }} />
              )}
            </div>

            {/* CODE */}
            <div style={{ fontSize: 13, letterSpacing: 2, color: "#9a8f8f", marginBottom: 6 }}>OR ENTER CODE</div>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 8, color: "#d4a847", fontFamily: "Georgia, serif" }}>
              {code}
            </div>

            {/* countdown */}
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#d4a847", transition: "width 1s linear" }} />
              </div>
              <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 8 }}>
                New code in {secondsLeft}s
              </div>
            </div>
          </>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#6f6565", marginTop: 16 }}>
        The code changes every {rotateSeconds} seconds to prevent remote clock-ins.
      </p>
    </div>
  );
}