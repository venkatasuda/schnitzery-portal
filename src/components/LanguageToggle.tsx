"use client";

import { useLang } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n";

// Small EN | DE switch. Place in the header or Profile settings.
export default function LanguageToggle() {
  const { locale, setLocale } = useLang();
  const opt = (l: Locale, label: string) => (
    <button
      onClick={() => l !== locale && setLocale(l)}
      aria-pressed={locale === l}
      style={{
        padding: "4px 9px",
        fontSize: 12,
        fontWeight: 700,
        border: "none",
        borderRadius: 6,
        cursor: l === locale ? "default" : "pointer",
        background: locale === l ? "var(--gold)" : "transparent",
        color: locale === l ? "#1a0e0e" : "var(--gray)",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 2, background: "var(--dark3)", borderRadius: 8, border: "1px solid rgba(128,128,128,0.2)" }}>
      {opt("en", "EN")}
      {opt("de", "DE")}
    </div>
  );
}