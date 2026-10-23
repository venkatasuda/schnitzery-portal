"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

// Replaces the root layout when it crashes, so no LanguageProvider: read the lang cookie.
const TEXT = {
  en: { title: "Something went wrong", body: "The error has been logged. Please try again.", retry: "Try again" },
  de: { title: "Etwas ist schiefgelaufen", body: "Der Fehler wurde gespeichert. Bitte erneut versuchen.", retry: "Erneut versuchen" },
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<"en" | "de">("en");
  useEffect(() => {
    Sentry.captureException(error);
    if (/(?:^|; )lang=de/.test(document.cookie)) setLang("de");
  }, [error]);
  const tx = TEXT[lang];

  return (
    <html lang={lang}>
      <body style={{ fontFamily: "system-ui, Arial, sans-serif", background: "#1a0e0e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, padding: 24, textAlign: "center" }}>
        <div role="alert">
          <h2 style={{ color: "#d4a847", marginBottom: 8 }}>{tx.title}</h2>
          <p style={{ color: "#c9bebe", marginBottom: 20, maxWidth: 340 }}>{tx.body}</p>
          <button onClick={() => reset()} style={{ padding: "11px 20px", borderRadius: 8, background: "#d4a847", color: "#1a1a1a", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{tx.retry}</button>
        </div>
      </body>
    </html>
  );
}
