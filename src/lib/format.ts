// Money in the app's language, not the device's: "1.234,50 €" in German, "€1,234.50" in English.
// digits: "auto" (0–2 decimals), 0 (whole euros), 2 (cents), or 4 (unit prices).
export function formatEur(n: number | null | undefined, locale: string, digits: "auto" | 0 | 2 | 4 = "auto"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // "auto": whole euros without cents, otherwise always two decimals (never "2.869,4 €").
  const cents = Math.round(n * 100) % 100 !== 0;
  const min = digits === 2 || digits === 4 || (digits === "auto" && cents) ? 2 : 0, max = digits === 4 ? 4 : digits === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: min, maximumFractionDigits: max }).format(n);
}

// Percent in the app's language: "0,1 %" in German, "0.1%" in English. Null → "—".
export function formatPct(n: number | null | undefined, locale: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return locale === "de" ? `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

// Pass the page language when rendering server-provided data so SSR and hydration agree.
// Cookie fallback remains for client-only callers.
export function appLocale(locale?: string): string {
  if (locale) return locale === "de" ? "de-DE" : "en-GB";
  // Read the language cookie, not <html lang>: Chrome's page translation rewrites <html lang>.
  // No cookie = app default (English), matching getLocale() on the server.
  if (typeof document === "undefined") return "en-GB";
  return /(?:^|;\s*)lang=de(?:;|$)/.test(document.cookie) ? "de-DE" : "en-GB";
}
