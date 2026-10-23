"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Honest, minimal cookie notice. The App sets only strictly-necessary cookies
// (auth/session) and any analytics are cookieless — so this is an INFORMATIONAL
// notice, not a tracking-consent gate. One-time dismiss, remembered locally.
// Rendered outside LanguageProvider (root layout), so it reads the `lang` cookie itself.
const KEY = "sch_cookie_ack";
const TEXT = {
  en: { body: "We use only essential cookies to keep you signed in. Usage stats, if any, are anonymous and cookieless.", privacy: "Privacy", ok: "Got it" },
  de: { body: "Wir verwenden nur notwendige Cookies, damit du angemeldet bleibst. Nutzungsstatistiken sind, falls vorhanden, anonym und ohne Cookies.", privacy: "Datenschutz", ok: "Verstanden" },
};

export default function CookieNotice() {
  const [lang, setLang] = useState<"en" | "de" | null>(null);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setLang(/(?:^|; )lang=de/.test(document.cookie) ? "de" : "en"); } catch { /* ignore */ }
  }, []);
  if (!lang) return null;
  const tx = TEXT[lang];

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setLang(null);
  }

  return (
    <div className="cookie-notice" role="region" aria-label={tx.privacy}>
      <div className="cookie-notice-card">
        <span>{tx.body} <Link href="/privacy" className="ui-text-link">{tx.privacy}</Link></span>
        <button className="btn-gold" onClick={dismiss}>{tx.ok}</button>
      </div>
    </div>
  );
}
