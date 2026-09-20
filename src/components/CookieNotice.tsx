"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Honest, minimal cookie notice. The App sets only strictly-necessary cookies
// (auth/session) and any analytics are cookieless — so this is an INFORMATIONAL
// notice, not a tracking-consent gate. One-time dismiss, remembered locally.
const KEY = "sch_cookie_ack";

export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* ignore */ }
  }, []);
  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 200, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", maxWidth: 620, width: "100%", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--dark2, #1e1e1e)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: "var(--gray-light, #aaa)", lineHeight: 1.5 }}>
          We use only essential cookies to keep you signed in. Usage stats, if any, are anonymous and cookieless.{" "}
          <Link href="/privacy" style={{ color: "var(--gold, #d4a847)", textDecoration: "none" }}>Privacy</Link>
        </span>
        <button
          onClick={dismiss}
          style={{ padding: "9px 18px", background: "var(--gold, #d4a847)", color: "#1a0e0e", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
