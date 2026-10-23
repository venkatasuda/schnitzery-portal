"use client";

import { serverText } from "@/lib/i18n/serverMessages";
import { useEffect, useState, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getCurrentClockCode } from "@/lib/queries/clockcode";

// MANAGER DISPLAY — show this on a tablet/screen at the restaurant.
// Staff scan the QR or type the 6-digit code to clock in/out.
export default function ClockDisplayPage() {
  const { t, locale } = useLang();
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
      setError(serverText(res.error ?? "", locale) || t("cd.couldNotLoad"));
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
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 4 }}>
        <Icon e="📲" size={24} style={{ verticalAlign: "-3px", marginRight: 8 }} /> {t("cd.title")}
      </h1>
      <p className="u-muted t-sm mb-6">
        {t("cd.subtitle")}
      </p>

      <div style={{ background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 20, padding: 32 }}>
        {error ? (
          <div style={{ color: "var(--danger)", padding: 30 }}>{error}</div>
        ) : (
          <>
            {/* QR */}
            <div className="d-flex jc-c mb-6">
              {qrImg ? (
                <img src={qrImg} alt={t("misc.clockQr")} style={{ width: 260, height: 260, borderRadius: 16, background: "#fff", padding: 8 }} />
              ) : (
                <div style={{ width: 260, height: 260, borderRadius: 16, background: "var(--surface-2)" }} />
              )}
            </div>

            {/* CODE */}
            <div style={{ fontSize: 13, letterSpacing: 2, color: "var(--gray)", marginBottom: 6 }}>{t("cd.orEnterCode")}</div>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 8, color: "var(--gold-ink)", fontFamily: "var(--font-body)" }}>
              {code}
            </div>

            {/* countdown */}
            <div className="mt-5">
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#d4a847", transition: "width 1s linear" }} />
              </div>
              <div className="ui-note">
                {t("cd.newCodeIn", { n: secondsLeft })}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="t-xs u-muted mt-4">
        {t("cd.codeChanges", { n: rotateSeconds })}
      </p>
    </div>
  );
}