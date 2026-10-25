"use client";

import { useLang } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n";

// Small EN | DE switch. Place in the header or Profile settings.
export default function LanguageToggle() {
  const { t, locale, setLocale } = useLang();
  const opt = (l: Locale, label: string, name: string) => (
    <button
      onClick={() => l !== locale && setLocale(l)}
      aria-pressed={locale === l}
      aria-label={name}
      type="button"
      className="language-option"
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t("misc.language")} className="language-switch">
      {opt("en", "EN", "English")}
      {opt("de", "DE", "Deutsch")}
    </div>
  );
}
